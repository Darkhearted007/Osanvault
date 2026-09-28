import { db } from 'hatchable';

export const access = 'admin';
export const methods = ['POST'];

const PHASE = '391.18';
const VERSION = '391.18.1';
const SOURCE = 'INEC-POLLING-UNIT-LOCATOR-2026';
const hash = async value => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))].map(x => x.toString(16).padStart(2,'0')).join('');
const q = async (sql, params=[]) => (await db.query(sql, params)).rows;

export default async function(req,res) {
  const only=req.body?.candidate_id;
  const candidates=only
    ? await q('SELECT id,status,exception_id FROM gis_exception_candidate_matches WHERE id=$1 AND status=$2',[only,'CANDIDATE_ONLY'])
    : await q('SELECT id,status,exception_id FROM gis_exception_candidate_matches WHERE status=$1 ORDER BY id',['CANDIDATE_ONLY']);
  if(only&&!candidates.length)return res.status(404).json({phase:PHASE,error:'candidate_not_found_or_not_candidate_only',production_gate:'NOT_READY'});
  const source=(await q('SELECT source_key,source_registry_id,source_url,authority_level FROM gis_canonical_source_identity WHERE source_key=$1 LIMIT 1',[SOURCE]))[0]||null;
  const run=(await q('INSERT INTO gis_inec_geographic_reconciliation_runs(phase,algorithm_version,candidate_count) VALUES($1,$2,$3) RETURNING id',[PHASE,VERSION,candidates.length]))[0];
  const decisions=[];
  for(const c of candidates){
    const evidence=(await q('SELECT evidence_decision,artifact_sha256,content_validation,decision_fingerprint FROM gis_inec_content_validation_decisions WHERE candidate_match_id=$1 AND canonical_source_key=$2 ORDER BY validated_at DESC LIMIT 1',[c.id,SOURCE]))[0]||null;
    const geo=(await q('SELECT id,decision,decision_fingerprint,inec_evidence_reference,artifact_id,artifact_sha256,provenance_reference,geometry_metadata,spatial_evidence,errors,candidate_mutation FROM gis_inec_geographic_reconciliation_decisions WHERE candidate_match_id=$1 ORDER BY decided_at DESC NULLS LAST,id DESC LIMIT 1',[c.id]))[0]||null;
    const errors=[];
    if(!evidence||evidence.evidence_decision!=='EVIDENCE_CONFIRMED')errors.push('No qualifying Phase 391.13 confirmed evidence decision exists');
    if(!geo)errors.push('No Phase 391.14 geographic reconciliation decision exists');
    if(geo?.candidate_mutation===true)errors.push('Upstream geographic reconciliation indicates candidate mutation');
    const decision=geo?.decision==='GEOGRAPHY_CONFIRMED'&&errors.length===0?'GEOGRAPHY_CONFIRMED':'GEOGRAPHY_UNVERIFIED';
    const geometry={source:geo?.geometry_metadata?.source||null,record_id:geo?.geometry_metadata?.record_id||null,authoritative_inec_geometry_tables:geo?.geometry_metadata?.authoritative_inec_geometry_tables||[],authoritative_geometry_present:decision==='GEOGRAPHY_CONFIRMED'};
    const provenance={canonical_source_key:SOURCE,source_registry_id:source?.source_registry_id||null,source_url:source?.source_url||null,authority_level:source?.authority_level||null,phase39113_fingerprint:evidence?.decision_fingerprint||null,phase39114_id:geo?.id||null,artifact_id:geo?.artifact_id||null,artifact_sha256:geo?.artifact_sha256||evidence?.artifact_sha256||null};
    const fp=await hash(JSON.stringify({candidate_id:c.id,decision,geometry,provenance,errors,algorithm:VERSION}));
    const ins=await q('INSERT INTO gis_inec_geographic_reconciliation_decisions (run_id,candidate_match_id,previous_status,proposed_status,decision,geometry_metadata,inec_evidence_reference,spatial_evidence,errors,artifact_id,artifact_sha256,provenance_reference,algorithm_version,decision_fingerprint,candidate_mutation,decided_at) VALUES ($1,$2,$3,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,false,now()) ON CONFLICT(decision_fingerprint) DO NOTHING RETURNING id',[run.id,c.id,c.status,decision,JSON.stringify(geometry),JSON.stringify(provenance),JSON.stringify({phase39113:evidence?.content_validation||null,phase39114:geo?.spatial_evidence||null}),JSON.stringify(errors),geo?.artifact_id||null,geo?.artifact_sha256||evidence?.artifact_sha256||null,JSON.stringify(provenance),VERSION,fp]);
    decisions.push({candidate_id:c.id,decision,authoritative_geometry:decision==='GEOGRAPHY_CONFIRMED',candidate_mutation:false,persisted:!!ins[0]?.id,decision_fingerprint:fp,errors});
  }
  const counts={}; for(const d of decisions)counts[d.decision]=(counts[d.decision]||0)+1;
  res.status(200).json({phase:PHASE,algorithm_version:VERSION,source,candidates_evaluated:candidates.length,counts,decisions,candidate_status_mutations:0,geometry_mutations:0,evidence_mutations:0,production_gate:decisions.some(x=>x.decision!=='GEOGRAPHY_CONFIRMED')?'NOT_READY':'READY',policy:'Fail-closed lineage only; no authoritative geometry is inferred from non-INEC geometry or text.'});
}