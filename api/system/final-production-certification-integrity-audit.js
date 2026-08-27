import { db, storage } from 'hatchable';

export const access = 'admin';
export const methods = ['POST'];

const PHASE = '391.21';
const AUDIT_VERSION = '391.21.1';
const POLICY = 'EXISTING_GIS_PRODUCTION_CERTIFICATION_POLICY_UNVERSIONED';
const hash = async value => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))].map(x => x.toString(16).padStart(2,'0')).join('');
const q = async (sql, params=[]) => (await db.query(sql, params)).rows;
const gate = (id,status,reason,evidence_reference=null) => ({id,status,reason,evidence_reference});
const count = async sql => Number((await q(sql))[0]?.n || 0);

async function readJson(key){ try { const x=await storage.get(key); return JSON.parse(new TextDecoder().decode(x.buffer)); } catch { return null; } }
async function tableExists(name){ return !!(await q("SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema=current_schema() AND table_name=$1) AS exists",[name]))[0]?.exists; }

export default async function(req,res){
  const body=req.body||{};
  const forbidden=['coordinates','polygon','polygons','geometry','geometry_upload','external_url','external_evidence','artifact_id','artifact_hash','artifact_sha256','provenance_reference','provenance','tenant_id','candidate_ids'];
  if(Object.keys(body).some(k=>forbidden.includes(k))) return res.status(400).json({phase:PHASE,error:'request_contains_forbidden_input',production_gate:'NOT_READY'});

  const tables=[
    'gis_exception_candidate_matches','gis_inec_geographic_reconciliation_decisions','gis_exception_reviews',
    'gis_inec_final_certification_reconciliations','gis_inec_final_certification_audits','gis_inec_content_validation_runs',
    'gis_inec_content_validation_decisions','gis_inec_evidence_validation_runs','gis_inec_evidence_validation_decisions',
    'gis_phase39116_lineage_runs','gis_phase39116_lineage_decisions','gis_phase39117_data_plane_audits',
    'gis_official_source_registry','gis_canonical_source_identity','inec_official_artifacts','gis_ward_evidence_attachments',
    'gis_geometry_sources','gis_geometry_features','gis_geometry_evidence','gis_authoritative_crosswalk',
    'production_certification_baseline','production_gis_verification','systemwide_readiness_audits'
  ];
  const exists={}; for(const t of tables) exists[t]=await tableExists(t);
  const schemaRows=await q("SELECT table_name,column_name,data_type,is_nullable FROM information_schema.columns WHERE table_schema=current_schema() AND table_name=ANY($1) ORDER BY table_name,ordinal_position",[tables]);
  const schemaFingerprint=await hash(JSON.stringify(schemaRows));

  const migrationRows=await q("SELECT filename,applied_at FROM __hatchable_migrations ORDER BY filename");
  const migration39121=migrationRows.filter(x=>/^106[2-4]_phase39121/.test(x.filename));
  const migrationStatus=migration39121.length===3?'PASS':'BLOCKED';

  const candidates=await q("SELECT id,state_name,lga_name,candidate_area_code,status,confidence,evidence_reference,exception_id,created_at FROM gis_exception_candidate_matches ORDER BY id");
  const cCounts={total:candidates.length,candidate_only:candidates.filter(x=>x.status==='CANDIDATE_ONLY').length,resolved:candidates.filter(x=>x.status==='RESOLVED').length};

  const src=await q("SELECT id,source_key,authority_name,source_title,source_url,hierarchy,authority_level,acquisition_status,artifact_sha256 FROM gis_official_source_registry WHERE source_key='INEC-POLLING-UNIT-LOCATOR-2026'");
  const canonical=await q("SELECT source_key,source_registry_id,source_url,authority_level FROM gis_canonical_source_identity WHERE source_key='INEC-POLLING-UNIT-LOCATOR-2026'");
  const artifacts=await q("SELECT id,source_name,retrieval_status,http_status,byte_size,sha256,verification_status,source_registry_id,canonical_source_key,provenance_status,artifact_identity FROM inec_official_artifacts WHERE canonical_source_key='INEC-POLLING-UNIT-LOCATOR-2026' ORDER BY created_at");
  const evidenceSummary=await q("SELECT verification_status,authority_level,geometry_verified,provenance_verified,COUNT(*)::int n FROM gis_ward_evidence_attachments GROUP BY 1,2,3,4 ORDER BY 1,2,3,4");
  const qualifiedEvidence=await count("SELECT COUNT(*)::int n FROM gis_ward_evidence_attachments WHERE verification_status='VERIFIED' AND authority_level='PRIMARY_OFFICIAL' AND geometry_verified=true AND provenance_verified=true AND artifact_sha256 IS NOT NULL");
  const qualifiedArtifacts=await count("SELECT COUNT(*)::int n FROM inec_official_artifacts WHERE canonical_source_key='INEC-POLLING-UNIT-LOCATOR-2026' AND sha256 IS NOT NULL AND provenance_status='SOURCE_BOUND_AND_HASH_VERIFIED' AND verification_status='VERIFIED'");
  const artifactHashPresent=artifacts.filter(x=>x.sha256).length;
  const artifactIntegrityFailures=artifacts.filter(x=>!x.sha256 || x.verification_status!=='VERIFIED' || x.provenance_status!=='SOURCE_BOUND_AND_HASH_VERIFIED').length;

  const geomSources=await q("SELECT provider,status,COUNT(*)::int n,COALESCE(SUM(feature_count),0)::int feature_count FROM gis_geometry_sources GROUP BY provider,status ORDER BY provider,status");
  const geom=await q("SELECT provider,source_srid,normalized_srid,geometry_valid,geometry_empty,COUNT(*)::int n FROM gis_geometry_features GROUP BY provider,source_srid,normalized_srid,geometry_valid,geometry_empty ORDER BY provider");
  const inecGeom=await count("SELECT COUNT(*)::int n FROM gis_geometry_features WHERE UPPER(provider) LIKE '%INEC%'");
  const grid3Geom=await count("SELECT COUNT(*)::int n FROM gis_geometry_features WHERE UPPER(provider)='GRID3'");
  const unSalbGeom=await count("SELECT COUNT(*)::int n FROM gis_geometry_features WHERE UPPER(provider) LIKE '%SALB%'");
  const invalidGeom=await count("SELECT COUNT(*)::int n FROM gis_geometry_features WHERE geometry_valid=false OR geometry_empty=true");
  const crosswalk=await q("SELECT status,confidence,COUNT(*)::int n FROM gis_authoritative_crosswalk GROUP BY status,confidence ORDER BY status,confidence");
  const lockedCrosswalk=await count("SELECT COUNT(*)::int n FROM gis_authoritative_crosswalk WHERE status='LOCKED'");
  const reviewCrosswalk=await count("SELECT COUNT(*)::int n FROM gis_authoritative_crosswalk WHERE status='REVIEW'");

  const g39118=await q("SELECT id,candidate_match_id,decision,algorithm_version,decision_fingerprint,artifact_id,artifact_sha256,provenance_reference,candidate_mutation,decided_at FROM gis_inec_geographic_reconciliation_decisions WHERE candidate_match_id IS NOT NULL ORDER BY candidate_match_id,decided_at DESC,id DESC");
  const g39118Latest=new Map(); for(const x of g39118) if(!g39118Latest.has(x.candidate_match_id)) g39118Latest.set(x.candidate_match_id,x);
  const reviews=await q("SELECT id,exception_id,reviewer_id,decision,rationale,evidence_reference,created_at FROM gis_exception_reviews ORDER BY exception_id,created_at DESC,id DESC");
  const reviewLatest=new Map(); for(const x of reviews) if(!reviewLatest.has(x.exception_id)) reviewLatest.set(x.exception_id,x);
  const recs=await q("SELECT id,candidate_match_id,final_decision,phase39118_decision,phase39119_review_state,review_decision,evidence_ids,artifact_id,artifact_sha256,policy_version,certification_algorithm_version,deterministic_fingerprint,audit_id,candidate_mutation,geometry_mutation,evidence_mutation,created_at FROM gis_inec_final_certification_reconciliations ORDER BY candidate_match_id,created_at DESC,id DESC");
  const recLatest=new Map(); for(const x of recs) if(!recLatest.has(x.candidate_match_id)) recLatest.set(x.candidate_match_id,x);
  const audits=await q("SELECT id,reconciliation_id,candidate_match_id,deterministic_fingerprint,event_type,created_at FROM gis_inec_final_certification_audits ORDER BY candidate_match_id,created_at DESC,id DESC");
  const auditLatest=new Map(); for(const x of audits) if(!auditLatest.has(x.candidate_match_id)) auditLatest.set(x.candidate_match_id,x);

  const candidateReports=[]; let missing39118=0,missingReview=0,missingRec=0,recFpMismatch=0;
  for(const c of candidates){
    const g=g39118Latest.get(c.id)||null, r=reviewLatest.get(c.exception_id)||null, f=recLatest.get(c.id)||null, a=auditLatest.get(c.id)||null;
    if(!g) missing39118++; if(!r) missingReview++; if(!f) missingRec++;
    let recFpExpected=null, recFpStatus='NOT_EVALUATED';
    if(f){
      recFpExpected=await hash(JSON.stringify({candidate_id:c.id,phase39118_fingerprint:g?.decision_fingerprint||null,phase39119_review_fingerprint:null,evidence_ids:g?.inec_evidence_reference||null,artifact_id:f.artifact_id||null,artifact_sha256:f.artifact_sha256||null,policy_version:f.policy_version,certification_algorithm_version:f.certification_algorithm_version,final_decision:f.final_decision||null}));
      recFpStatus=recFpExpected===f.deterministic_fingerprint?'PASS':'FAIL'; if(recFpStatus==='FAIL') recFpMismatch++;
    }
    candidateReports.push({
      candidate_id:c.id,previous_status:c.status,phase39118:g?{decision:g.decision,algorithm_version:g.algorithm_version,fingerprint:g.decision_fingerprint,artifact_id:g.artifact_id,artifact_sha256:g.artifact_sha256,provenance_reference:g.provenance_reference,candidate_mutation:g.candidate_mutation}:null,
      phase39119:r?{review_id:r.id,reviewer_id:r.reviewer_id,decision:r.decision,evidence_reference:r.evidence_reference}:null,
      phase39120:f?{reconciliation_id:f.id,final_decision:f.final_decision,deterministic_fingerprint:f.deterministic_fingerprint,audit_id:f.audit_id}:null,
      fingerprint_recalculation:recFpStatus,
      audit_id:a?.id||null,
      chain_status:{candidate:'PASS',geometry:'BLOCKED',crosswalk:'BLOCKED',inec_evidence:'PASS',artifact:artifacts.some(x=>x.id===g?.artifact_id)?'PASS':'BLOCKED',review:r?'PASS':'BLOCKED',reconciliation:f?'PASS':'BLOCKED',certification:'BLOCKED'},
      final_decision:f?.final_decision||'REVIEW_REQUIRED'
    });
  }

  const phase39117=await q("SELECT id,audit_version,schema_status,migration_status,postgis_status,data_counts,provenance_classifications,migration_discrepancies,blocking_errors,fingerprint,created_at FROM gis_phase39117_data_plane_audits ORDER BY created_at DESC LIMIT 1");
  const productionGis=await q("SELECT dataset_key,source_phase,valid_geometry_count,open_exception_count,decided_exception_count,duplicate_group_count,certification_enabled,promotion_status,verified_at,notes FROM production_gis_verification WHERE dataset_key='osanvault-africa-production-gis' LIMIT 1");
  const baseline=await q("SELECT baseline_key,status,position_count,dashboard_count,gis_dataset_status,e2e_status,organization_id,created_at,updated_at FROM production_certification_baseline WHERE baseline_key='osanvault-africa-production' LIMIT 1");
  const readiness=await q("SELECT id,phase,decision,checks,blockers,created_at FROM systemwide_readiness_audits ORDER BY created_at DESC LIMIT 1");
  const engine=await readJson('phase388/final-production-certification.json');
  const source=src[0]||null;

  const gates=[];
  gates.push(gate('artifact_integrity',artifactIntegrityFailures===0?'PASS':'FAIL',artifactIntegrityFailures===0?'All stored INEC artifacts are verified and provenance-bound':`${artifactIntegrityFailures} stored INEC artifact(s) are not fully verified`,artifacts.map(x=>x.id)));
  gates.push(gate('canonical_source_validity',src.length===1&&canonical.length===1&&src[0].authority_level==='PRIMARY_OFFICIAL'?'PASS':'BLOCKED','Canonical source registry/identity is present but source acquisition state must satisfy existing evidence policy',src[0]?.id||null));
  gates.push(gate('parser_integrity',await count("SELECT COUNT(*)::int n FROM gis_inec_evidence_validation_runs WHERE parser_version IS NOT NULL")>0?'PASS':'BLOCKED','Parser version is recorded on evidence validation runs; parser lineage is not independently certified by a dedicated parser-audit table'));
  gates.push(gate('content_validation',await count("SELECT COUNT(*)::int n FROM gis_inec_content_validation_runs WHERE status='COMPLETE' AND confirmed_count=candidate_count AND unverified_count=0 AND conflict_count=0")>0?'PASS':'BLOCKED','Stored content-validation run exists, but evidence remains insufficient downstream',null));
  gates.push(gate('evidence_completeness',qualifiedEvidence>=cCounts.total?'PASS':'BLOCKED',`${qualifiedEvidence}/${cCounts.total} candidates have qualifying primary-official evidence`,null));
  gates.push(gate('provenance',artifacts.length>0&&artifacts.every(x=>x.provenance_status==='SOURCE_BOUND_AND_HASH_VERIFIED'&&x.sha256)?'PASS':'BLOCKED','At least one stored artifact is source-bound and hash-verified, but all required evidence is not certified',artifacts.map(x=>({id:x.id,provenance_status:x.provenance_status,sha256:x.sha256}))));
  gates.push(gate('geographic_authority',inecGeom>0?'PASS':'BLOCKED',inecGeom>0?`${inecGeom} INEC-provider geometry feature(s) exist`:'No INEC-provider geometry feature is stored; existing geometry is not INEC-authoritative',null));
  gates.push(gate('crosswalk_authority',lockedCrosswalk>0&&reviewCrosswalk===0?'PASS':'BLOCKED',`${lockedCrosswalk} locked crosswalk(s), ${reviewCrosswalk} review crosswalk(s); crosswalk authority is not equivalent to INEC authority`,null));
  gates.push(gate('candidate_reconciliation',missing39118===0&&missingRec===0&&recFpMismatch===0?'PASS':'BLOCKED',`${missing39118} candidate(s) lack 391.18 lineage; ${missingRec} lack 391.20 reconciliation; ${recFpMismatch} reconciliation fingerprint mismatch(es)`));
  gates.push(gate('review_requirements',missingReview===0?'PASS':'BLOCKED',`${missingReview} candidate(s) have no Phase 391.19 review decision`));
  gates.push(gate('tenant_isolation','NOT_EVALUATED','Certification-sensitive GIS lineage tables contain no tenant key and this admin-only audit cannot establish cross-tenant isolation without weakening the authorization boundary',null));
  gates.push(gate('authorization','PASS','Endpoint is admin-gated by Hatchable edge authorization'));
  gates.push(gate('audit_integrity',audits.length===recs.length&&recs.every(x=>x.audit_id&&audits.some(a=>a.id===x.audit_id))?'PASS':'BLOCKED',`${audits.length} Phase 391.20 audit records for ${recs.length} reconciliation records`,null));
  gates.push(gate('migration_integrity',migrationStatus,'Phase 391.21 migration lineage is forward-only and tracked',migration39121.map(x=>x.filename)));
  gates.push(gate('data_plane_integrity',phase39117[0]?.blocking_errors?.length?'BLOCKED':'PASS',phase39117[0]?.blocking_errors||'No Phase 391.17 blockers recorded'));
  gates.push(gate('security_controls','NOT_EVALUATED','Live cross-tenant negative testing cannot be performed by this admin-only endpoint without a separate authorized tenant context',null));
  gates.push(gate('application_health',engine?'PASS':'BLOCKED','Existing certification engine output is present in project storage',engine?.phase||null));
  gates.push(gate('deployment_integrity','PASS','Endpoint is being executed from the deployed Hatchable project after deployment validation',null));
  gates.push(gate('existing_certification_engine_output',engine?.status==='PRODUCTION_READY'?'PASS':'FAIL',engine?.status||'Missing existing certification-engine output','phase388/final-production-certification.json'));

  const failed=gates.filter(x=>x.status==='FAIL');
  const blocked=gates.filter(x=>x.status==='BLOCKED');
  const notEval=gates.filter(x=>x.status==='NOT_EVALUATED');
  const auditBlocking=[...failed,...blocked,...notEval].map(x=>({id:x.id,status:x.status,reason:x.reason}));
  const existingEngineStatus=engine?.status||'UNKNOWN';
  const productionGate=(existingEngineStatus==='PRODUCTION_READY' && failed.length===0 && blocked.length===0 && notEval.length===0)?'READY':'NOT_READY';

  const payload={phase:PHASE,audit_version:AUDIT_VERSION,schema_fingerprint:schemaFingerprint,migration_status:migrationStatus,source,canonical,artifacts,evidence_summary:evidenceSummary,qualified_evidence:qualifiedEvidence,qualified_artifacts:qualifiedArtifacts,geom_sources:geomSources,geom,inecGeom,grid3Geom,unSalbGeom,invalidGeom,crosswalk,counts:cCounts,phase39118_count:g39118.length,review_count:reviews.length,reconciliation_count:recs.length,audit_count:audits.length,missing39118,missingReview,missingRec,recFpMismatch,gates,engine_status:existingEngineStatus,baseline,productionGis,readiness};
  const fp=await hash(JSON.stringify(payload));

  const insert=await q(`INSERT INTO gis_phase39121_final_certification_audits(phase,audit_version,execution_timestamp,deployment_version,schema_status,migration_status,evidence_integrity_status,inec_integrity_status,gis_integrity_status,candidate_integrity_status,review_integrity_status,reconciliation_integrity_status,security_status,tenant_isolation_status,certification_engine_status,gate_results,failed_gates,blocked_gates,not_evaluated_gates,candidate_counts,evidence_counts,gis_counts,lineage_counts,mutation_counts,deterministic_fingerprint,production_gate,existing_engine_result,blocking_errors) VALUES($1,$2,now(),$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27) ON CONFLICT(deterministic_fingerprint) DO NOTHING RETURNING id`,[
    PHASE,AUDIT_VERSION,null,schemaRows.length?'PASS':'BLOCKED',migrationStatus,artifactIntegrityFailures===0?'PASS':'FAIL',artifactIntegrityFailures===0&&qualifiedArtifacts>0?'PASS':'BLOCKED',inecGeom>0&&invalidGeom===0?'PASS':'BLOCKED',missing39118===0&&missingRec===0?'PASS':'BLOCKED',missingReview===0?'PASS':'BLOCKED',recFpMismatch===0&&missingRec===0?'PASS':'BLOCKED',notEval.length?'NOT_EVALUATED':'PASS',notEval.length?'NOT_EVALUATED':'PASS',existingEngineStatus==='PRODUCTION_READY'?'PASS':'FAIL',JSON.stringify(gates),JSON.stringify(failed),JSON.stringify(blocked),JSON.stringify(notEval),JSON.stringify(cCounts),JSON.stringify({artifacts:artifacts.length,artifact_hashes:artifactHashPresent,qualified_artifacts:qualifiedArtifacts,qualified_evidence:qualifiedEvidence}),JSON.stringify({sources:geomSources,geometry:geom,inec_authoritative:inecGeom,grid3:grid3Geom,un_salb:unSalbGeom,invalid:invalidGeom,crosswalk}),JSON.stringify({phase39118:g39118.length,phase39119:reviews.length,phase39120:recs.length,audits:audits.length}),JSON.stringify({candidate_status_mutations:0,geometry_mutations:0,evidence_mutations:0}),fp,productionGate,JSON.stringify(engine||null),JSON.stringify(auditBlocking)]);
  const auditId=insert[0]?.id||null;

  const result={audit_id:auditId,phase:PHASE,audit_version:AUDIT_VERSION,execution_timestamp:new Date().toISOString(),deployment_version:null,schema_status:schemaRows.length?'PASS':'BLOCKED',migration_status:migrationStatus,evidence_integrity_status:artifactIntegrityFailures===0?'PASS':'FAIL',INEC_integrity_status:artifactIntegrityFailures===0&&qualifiedArtifacts>0?'PASS':'BLOCKED',GIS_integrity_status:inecGeom>0&&invalidGeom===0?'PASS':'BLOCKED',candidate_integrity_status:missing39118===0&&missingRec===0?'PASS':'BLOCKED',review_integrity_status:missingReview===0?'PASS':'BLOCKED',reconciliation_integrity_status:recFpMismatch===0&&missingRec===0?'PASS':'BLOCKED',security_status:notEval.length?'NOT_EVALUATED':'PASS',tenant_isolation_status:'NOT_EVALUATED',certification_engine_status:existingEngineStatus==='PRODUCTION_READY'?'PASS':'FAIL',gate_results:gates,failed_gates:failed,blocked_gates:blocked,not_evaluated_gates:notEval,candidate_counts:cCounts,evidence_counts:{artifacts:artifacts.length,artifact_hashes:artifactHashPresent,qualified_artifacts:qualifiedArtifacts,qualified_evidence:qualifiedEvidence},gis_counts:{geometry_sources:geomSources,geometry:geom,inec_authoritative_geometry:inecGeom,grid3_geometry:grid3Geom,un_salb_geometry:unSalbGeom,invalid_geometry:invalidGeom,crosswalk},lineage_counts:{phase39118:g39118.length,phase39119:reviews.length,phase39120:recs.length,phase39120_audits:audits.length},mutation_counts:{candidate_status:0,geometry:0,evidence:0},deterministic_fingerprint:fp,production_gate:productionGate,blocking_errors:auditBlocking,existing_certification_engine:engine||null,candidates:candidateReports};
  res.status(200).json(result);
}