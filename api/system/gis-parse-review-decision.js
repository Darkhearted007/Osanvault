import { db } from 'hatchable';
export const access='admin'; export const methods=['POST'];
export default async function(req,res){
  const b=req.body||{};
  const allowed=['APPROVE_PARSING','REJECT_PARSING','HOLD','REQUEST_REPROCESSING'];
  if(!b.parse_audit_id||!allowed.includes(b.decision)||!String(b.rationale||'').trim()) return res.status(400).json({error:'parse_audit_id, valid decision and rationale are required'});
  const audit=(await db.query(`SELECT p.id,p.artifact_id,p.status,p.artifact_sha256,a.canonical_source_key,a.verification_status,a.provenance_status FROM gis_artifact_parse_audits p JOIN inec_official_artifacts a ON a.id=p.artifact_id WHERE p.id=$1 LIMIT 1`,[String(b.parse_audit_id)])).rows[0];
  if(!audit)return res.status(404).json({error:'parse audit not found'});
  if(audit.canonical_source_key!=='INEC-POLLING-UNIT-LOCATOR-2026')return res.status(409).json({error:'review blocked: artifact is not bound to the canonical INEC source'});
  if(audit.verification_status!=='VERIFIED'||!['SOURCE_BOUND_AND_HASH_VERIFIED','VERIFIED'].includes(audit.provenance_status))return res.status(409).json({error:'review blocked: source artifact is not fully verified'});
  const reviewer=req.member.id;
  await db.query(`INSERT INTO gis_parse_review_decisions(artifact_id,parse_audit_id,reviewer_id,decision,rationale) VALUES($1,$2,$3,$4,$5) ON CONFLICT(parse_audit_id,reviewer_id) DO UPDATE SET decision=EXCLUDED.decision,rationale=EXCLUDED.rationale,created_at=now()`,[audit.artifact_id,audit.id,reviewer,b.decision,String(b.rationale).trim()]);
  res.json({ok:true,parse_audit_id:audit.id,decision:b.decision,reviewer_id:reviewer,candidate_mutation:false,identity_resolution:false,promotion:false,policy:'Administrative parsing review is append-only and separate from identity verification, approval and promotion.'});
}