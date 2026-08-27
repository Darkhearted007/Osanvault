import { db } from 'hatchable';
export const access='admin';
export const methods=['GET'];
export default async function(req,res){
 const a=(await db.query("SELECT id,canonical_source_key,source_registry_id,sha256,verification_status,provenance_status,retrieval_status FROM inec_official_artifacts WHERE canonical_source_key='INEC-POLLING-UNIT-LOCATOR-2026' ORDER BY created_at DESC LIMIT 1")).rows[0];
 const r=(await db.query("SELECT id,phase,artifact_id,artifact_sha256,parser_version,candidate_count,confirmed_count,insufficient_count,conflict_count,not_found_count,unverified_count,status,created_at,completed_at FROM gis_inec_evidence_validation_runs ORDER BY created_at DESC LIMIT 1")).rows[0]||null;
 const c=(await db.query("SELECT COUNT(*)::int total,COUNT(*) FILTER(WHERE status='CANDIDATE_ONLY')::int candidate_only,COUNT(*) FILTER(WHERE status='RESOLVED')::int resolved FROM gis_exception_candidate_matches")).rows[0];
 res.json({phase:'391.12',artifact:a||null,latest_validation_run:r,candidates:c,production_gate:'NOT_READY',policy:'Status is observational. Candidate statuses are never changed by validation.'});
}