import { db } from 'hatchable';
export const access='admin';
export const methods=['GET'];
const checks=[]; const blockers=[];
async function probe(name,sql,params=[]){try{const r=await db.query(sql,params);checks.push({name,status:'PASS',result:r.rows});return r.rows;}catch(e){const error=String(e?.message||e);checks.push({name,status:'BLOCKED',error});blockers.push({name,error});return null;}}
export default async function(req,res){
 checks.length=0; blockers.length=0;
 await probe('database','SELECT current_database() AS database_name,current_schema() AS schema_name');
 await probe('canonical_inec_source',"SELECT COUNT(*)::int AS n FROM gis_canonical_source_identity WHERE source_key='INEC-POLLING-UNIT-LOCATOR-2026'");
 await probe('gis_candidate_count','SELECT COUNT(*)::int AS n FROM gis_exception_candidate_matches');
 await probe('gis_candidate_statuses','SELECT status,COUNT(*)::int AS n FROM gis_exception_candidate_matches GROUP BY status ORDER BY status');
 await probe('inec_artifacts','SELECT retrieval_status,verification_status,provenance_status,COUNT(*)::int AS n FROM inec_official_artifacts GROUP BY retrieval_status,verification_status,provenance_status ORDER BY retrieval_status');
 await probe('evidence_gate',"SELECT COUNT(*)::int AS verified FROM gis_ward_evidence_attachments WHERE verification_status='VERIFIED' AND authority_level='PRIMARY_OFFICIAL' AND geometry_verified=true AND provenance_verified=true AND artifact_sha256 IS NOT NULL");
 await probe('promotion_audit','SELECT COUNT(*)::int AS promoted FROM gis_exception_candidate_matches WHERE status=\'RESOLVED\'');
 await probe('platform_e2e','SELECT COUNT(*)::int AS runs FROM platform_e2e_test_runs');
 await probe('stabilization','SELECT COUNT(*)::int AS runs FROM platform_stabilization_runs');
 const decision=blockers.length?'NOT_RECONCILED':'OBSERVED';
 const row=await db.query('INSERT INTO system_critical_workflow_audits(phase,checks,blockers,decision,notes) VALUES($1,$2,$3,$4,$5) RETURNING id',['391.4',JSON.stringify(checks),JSON.stringify(blockers),decision,'Observation-only audit; no candidate, evidence, review, or promotion mutation.']);
 res.status(blockers.length?409:200).json({phase:'391.4',auditId:row.rows[0].id,decision,checks,blockers,production_gate:'NOT_READY'});
}