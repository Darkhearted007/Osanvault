import { db } from 'hatchable';
export const access='admin';
export const methods=['POST'];
const SOURCE='INEC-POLLING-UNIT-LOCATOR-2026';
const PARSER='391.29.1';
async function digest(v){const d=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(String(v)));return [...new Uint8Array(d)].map(x=>x.toString(16).padStart(2,'0')).join('')}
function decisionFor(c,rows){
  if(!rows.length)return ['EVIDENCE_NOT_FOUND',['No parsed artifact row matches the candidate State/LGA.']];
  const exact=rows.filter(r=>String(r.state_name||'').trim().toUpperCase()===String(c.state_name||'').trim().toUpperCase()&&String(r.lga_name||'').trim().toUpperCase()===String(c.lga_name||'').trim().toUpperCase());
  if(exact.length===1&&exact[0].ward_name&&exact[0].ward_code)return ['EVIDENCE_CONFIRMED',[]];
  if(exact.length>1)return ['EVIDENCE_CONFLICT',['Multiple qualifying parsed rows match the candidate.']];
  return ['EVIDENCE_INSUFFICIENT',['Parsed artifact does not contain a qualifying Ward/Registration Area identity for this candidate.']];
}
export default async function(req,res){
  const b=req.body||{};
  const artifactId=b.artifact_id;
  if(!artifactId)return res.status(400).json({error:'artifact_id is required',decision:'EVIDENCE_UNVERIFIED',candidate_mutation:false});
  const a=(await db.query('SELECT id,canonical_source_key,source_registry_id,source_url,sha256,verification_status,provenance_status,retrieval_status FROM inec_official_artifacts WHERE id=$1',[artifactId])).rows[0];
  if(!a)return res.status(404).json({error:'artifact not found',decision:'EVIDENCE_UNVERIFIED',candidate_mutation:false});
  const gate=a.canonical_source_key===SOURCE&&a.retrieval_status==='RETRIEVED'&&!!a.sha256&&(a.provenance_status==='SOURCE_BOUND_AND_HASH_VERIFIED'||a.provenance_status==='VERIFIED')&&(a.verification_status==='VERIFIED'||a.verification_status==='PENDING_CONTENT_VALIDATION');
  if(!gate)return res.status(409).json({error:'artifact failed authority/integrity gate',decision:'EVIDENCE_UNVERIFIED',artifact:a,candidate_mutation:false});
  const p=(await db.query("SELECT parser_version,artifact_sha256,records_extracted,status,parsed_at FROM gis_artifact_parse_audits WHERE artifact_id=$1 AND status='PARSED' ORDER BY records_extracted DESC, parsed_at DESC LIMIT 1",[artifactId])).rows[0];
  if(!p||p.artifact_sha256!==a.sha256||p.parser_version!==PARSER||p.status!=='PARSED')return res.status(409).json({error:'parser lineage gate failed',decision:'EVIDENCE_UNVERIFIED',candidate_mutation:false});
  const candidateId=b.candidate_match_id;
  const candidates=candidateId?(await db.query("SELECT id,state_name,lga_name,candidate_area_code,status FROM gis_exception_candidate_matches WHERE id=$1 AND status='CANDIDATE_ONLY'",[candidateId])).rows:(await db.query("SELECT id,state_name,lga_name,candidate_area_code,status FROM gis_exception_candidate_matches WHERE status='CANDIDATE_ONLY' ORDER BY state_name,lga_name",[])).rows;
  if(candidateId&&!candidates.length)return res.status(404).json({error:'candidate not found or not candidate-only',candidate_mutation:false});
  const parsed=(await db.query('SELECT id,state_name,lga_name,ward_name,ward_code,polling_unit_name,source_page,raw_text,row_hash FROM gis_official_artifact_rows WHERE artifact_id=$1 ORDER BY id',[artifactId])).rows;
  const run=(await db.query('INSERT INTO gis_inec_evidence_validation_runs(phase,artifact_id,artifact_sha256,parser_version,candidate_count) VALUES($1,$2,$3,$4,$5) RETURNING id',['391.12',a.id,a.sha256,p.parser_version,candidates.length])).rows[0];
  const out=[];let confirmed=0,insufficient=0,conflict=0,notFound=0,unverified=0;
  for(const c of candidates){
    const [decision,errors]=decisionFor(c,parsed);
    if(decision==='EVIDENCE_CONFIRMED')confirmed++;else if(decision==='EVIDENCE_INSUFFICIENT')insufficient++;else if(decision==='EVIDENCE_CONFLICT')conflict++;else if(decision==='EVIDENCE_NOT_FOUND')notFound++;else unverified++;
    const matches=parsed.filter(r=>String(r.state_name||'').trim().toUpperCase()===String(c.state_name||'').trim().toUpperCase()&&String(r.lga_name||'').trim().toUpperCase()===String(c.lga_name||'').trim().toUpperCase());
    const evidenceReference={artifact_id:a.id,artifact_sha256:a.sha256,canonical_source_key:a.canonical_source_key,source_registry_id:a.source_registry_id,parser_version:p.parser_version,parse_audit:{artifact_id:a.id,parser_version:p.parser_version,records_extracted:p.records_extracted,parsed_at:p.parsed_at},matched_artifact_rows:matches.map(r=>({artifact_row_id:r.id,row_hash:r.row_hash,state_name:r.state_name,lga_name:r.lga_name,ward_name:r.ward_name,ward_code:r.ward_code,polling_unit_name:r.polling_unit_name}))};
    // Logical decision identity is derived ONLY from immutable validation inputs.
    // parse_audit.parsed_at and the evaluated decision/evidence payload are execution
    // outputs and MUST NOT participate in the logical identity. Phase 391.26 proved
    // that including execution-varying data allowed duplicate logical decisions.
    const fingerprint=await digest(JSON.stringify({candidate_id:c.id,artifact_id:a.id,artifact_sha256:a.sha256,parser_version:p.parser_version}));
    // Serialize competing evaluations for the same immutable candidate/artifact subject.
    // The advisory lock and NOT EXISTS check execute in one SQL statement/transaction,
    // so concurrent retries cannot create another logical decision. Existing historical
    // duplicates are preserved and never rewritten or deleted.
    const ins=await db.query(`WITH locked AS (
      SELECT pg_advisory_xact_lock(hashtextextended($1,0)) AS locked
    )
    INSERT INTO gis_inec_evidence_validation_decisions(
      run_id,candidate_match_id,artifact_id,artifact_sha256,canonical_source_key,
      source_registry_id,parser_version,evidence_decision,evidence_reference,
      validation_errors,decision_fingerprint,candidate_status_before,candidate_mutation
    )
    SELECT $2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,false
    FROM locked
    WHERE NOT EXISTS (
      SELECT 1
      FROM gis_inec_evidence_validation_decisions d
      WHERE d.candidate_match_id=$3
        AND d.artifact_id=$4
        AND d.artifact_sha256=$5
        AND d.parser_version=$8
    )
    ON CONFLICT(decision_fingerprint) DO NOTHING
    RETURNING id,validated_at`,[
      `${c.id}:${a.id}:${a.sha256}:${p.parser_version}`,
      run.id,c.id,a.id,a.sha256,a.canonical_source_key,a.source_registry_id,
      p.parser_version,decision,JSON.stringify(evidenceReference),JSON.stringify(errors),
      fingerprint,c.status
    ]);
    out.push({candidate_id:c.id,state_name:c.state_name,lga_name:c.lga_name,candidate_area_code:c.candidate_area_code,candidate_status:c.status,artifact_id:a.id,artifact_sha256:a.sha256,canonical_source:a.canonical_source_key,parser_version:p.parser_version,evidence_decision:decision,evidence_reference:evidenceReference,validation_errors:errors,candidate_mutation:false,audit_id:ins.rows[0]?.id||null});
  }
  await db.query('UPDATE gis_inec_evidence_validation_runs SET confirmed_count=$1,insufficient_count=$2,conflict_count=$3,not_found_count=$4,unverified_count=$5,status=$6,completed_at=now() WHERE id=$7',[confirmed,insufficient,conflict,notFound,unverified,(insufficient||conflict||notFound||unverified)?'COMPLETE_WITH_HOLDS':'COMPLETE',run.id]);
  res.status(200).json({phase:'391.12',run_id:run.id,artifact_id:a.id,artifact_sha256:a.sha256,canonical_source_key:a.canonical_source_key,source_registry_id:a.source_registry_id,parser_version:p.parser_version,validation_timestamp:new Date().toISOString(),candidate_count:candidates.length,confirmed,insufficient,conflicts:conflict,not_found:notFound,unverified,decisions:out,certification:{production_gate:'NOT_READY',reason:'Authoritative content validation is incomplete unless every candidate has qualifying evidence and controlled review.'},policy:'Validation is append-only and deterministic. It never mutates candidate status, never fabricates evidence, and fails closed on authority, integrity, provenance, or parser-lineage failures.'});
}