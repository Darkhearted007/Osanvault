import { db, storage } from 'hatchable';
export const access='admin';
export const methods=['GET'];
const SOURCE='INEC-POLLING-UNIT-LOCATOR-2026';
const SOURCE_ID='1a17203d-270d-475c-99ae-871d232397be';
// Current artifact is selected from the canonical source registry below; no stale artifact ID is hardcoded.
async function sha(buf){const d=await crypto.subtle.digest('SHA-256',buf);return [...new Uint8Array(d)].map(x=>x.toString(16).padStart(2,'0')).join('')}
export default async function(req,res){
 const source=(await db.query("SELECT id,source_key,source_url,authority_level,acquisition_status FROM gis_official_source_registry WHERE source_key=$1",[SOURCE])).rows;
 const canonical=(await db.query("SELECT source_key,source_registry_id,source_url,authority_level FROM gis_canonical_source_identity WHERE source_key=$1",[SOURCE])).rows;
 const a=(await db.query("SELECT id,source_registry_id,canonical_source_key,source_url,retrieval_status,http_status,content_type,byte_size,sha256,storage_key,verification_status,provenance_status FROM inec_official_artifacts WHERE canonical_source_key=$1 ORDER BY created_at DESC LIMIT 1",[SOURCE])).rows[0]||null;
 const blockers=[]; if(source.length!==1)blockers.push('canonical source registry cardinality is not exactly one'); if(!canonical[0]||canonical[0].source_registry_id!==SOURCE_ID)blockers.push('canonical source identity does not resolve to the expected source registry id'); if(!a)blockers.push('expected artifact record is missing');
 let storedHash=null,bytes=null; if(a?.storage_key){try{const s=await storage.get(a.storage_key);bytes=s?.buffer; if(bytes)storedHash=await sha(bytes);else blockers.push('stored artifact bytes unavailable');}catch(e){blockers.push('stored artifact bytes unavailable: '+String(e?.message||e));}}
 if(a?.sha256&&storedHash&&a.sha256!==storedHash)blockers.push('stored artifact SHA-256 mismatch');
 if(a?.retrieval_status!=='RETRIEVED')blockers.push('artifact retrieval is not successful');
 if(a?.http_status!==200)blockers.push('artifact HTTP status is not 200');
 if(a?.verification_status!=='PENDING_CONTENT_VALIDATION'&&a?.verification_status!=='VERIFIED')blockers.push('artifact verification state is invalid');
 if(a?.provenance_status!=='SOURCE_BOUND_AND_HASH_VERIFIED'&&a?.provenance_status!=='VERIFIED')blockers.push('artifact provenance state is invalid');
 const parsed= a ? Number((await db.query("SELECT COUNT(*)::int n FROM gis_official_artifact_rows WHERE artifact_id=$1",[a.id])).rows[0]?.n||0) : 0;
 const validated=a ? Number((await db.query("SELECT COUNT(DISTINCT candidate_match_id)::int n FROM gis_inec_evidence_validation_decisions WHERE artifact_id=$1",[a.id])).rows[0]?.n||0) : 0;
 const qualifying=Number((await db.query("SELECT COUNT(*)::int n FROM gis_ward_evidence_attachments WHERE verification_status='VERIFIED' AND authority_level='PRIMARY_OFFICIAL' AND geometry_verified=true AND provenance_verified=true AND artifact_sha256 IS NOT NULL")).rows[0]?.n||0);
 const reviewed=Number((await db.query("SELECT COUNT(DISTINCT exception_id)::int n FROM gis_exception_reviews")).rows[0]?.n||0);
 const promoted=Number((await db.query("SELECT COUNT(*)::int n FROM gis_inec_final_certification_reconciliations WHERE final_decision='PROMOTE' AND candidate_mutation=true")).rows[0]?.n||0);
 if(parsed===0)blockers.push('no parsed artifact rows exist'); if(validated===0)blockers.push('no candidate validation decisions exist'); if(qualifying===0)blockers.push('no fully verified primary-official evidence exists'); if(reviewed===0)blockers.push('no administrative review decision exists');
 const candidates=Number((await db.query("SELECT COUNT(*)::int n FROM gis_exception_candidate_matches")).rows[0]?.n||0); if(candidates!==30)blockers.push('candidate preservation invariant failed');
 const gate=blockers.length?'NOT_READY':'NOT_READY';
 const ins=await db.query("INSERT INTO gis_phase39128_provenance_gate_audits(phase,source_key,source_registry_id,artifact_id,artifact_sha256,artifact_retrieval_status,artifact_verification_status,artifact_provenance_status,parsed_records,validated_candidates,qualifying_evidence,reviewed_candidates,promoted_candidates,production_gate,blockers) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING id",['391.28',SOURCE,SOURCE_ID,a?.id||null,a?.sha256||null,a?.retrieval_status||null,a?.verification_status||null,a?.provenance_status||null,parsed,validated,qualifying,reviewed,promoted,gate,JSON.stringify(blockers)]);
 res.status(200).json({phase:'391.28',audit_id:ins.rows[0].id,source,canonical_source:canonical[0]||null,artifact:a?{...a,computed_sha256:storedHash,computed_byte_size:bytes?.byteLength||null}:null,chain:{parsed_records:parsed,validated_candidates:validated,qualifying_evidence:qualifying,reviewed_candidates:reviewed,promoted_candidates:promoted,total_candidates:candidates},blockers,production_gate:gate,decision:'PROVENANCE_GATE_REMAINS_CLOSED',policy:'Observation-only. No candidate, evidence, review, or promotion record is created or modified by this endpoint.'});
}