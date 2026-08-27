import { db } from 'hatchable';
export const access='admin';
export const methods=['GET'];
export default async function(req,res){
 const checks=[]; const blockers=[];
 const probes=[
  ['security_controls',"SELECT COUNT(*)::int AS n FROM security_controls"],
  ['tenant_security_controls',"SELECT COUNT(*)::int AS n FROM tenant_security_controls"],
  ['gis_candidates',"SELECT COUNT(*)::int AS n FROM gis_exception_candidate_matches"],
  ['verification_cases',"SELECT COUNT(*)::int AS n FROM verification_cases"]
 ];
 for(const [name,sql] of probes){try{const r=await db.query(sql);checks.push({name,status:'PASS',result:r.rows});}catch(e){const error=String(e?.message||e);checks.push({name,status:'BLOCKED',error});blockers.push({name,error});}}
 const decision=blockers.length?'NOT_RECONCILED':'OBSERVED';
 const r=await db.query('INSERT INTO security_authorization_audits(phase,checks,blockers,decision,notes) VALUES($1,$2,$3,$4,$5) RETURNING id',['391.6',JSON.stringify(checks),JSON.stringify(blockers),decision,'Observation-only authorization regression audit; no business records mutated.']);
 res.status(blockers.length?409:200).json({phase:'391.6',auditId:r.rows[0].id,decision,checks,blockers,production_gate:'NOT_READY'});
}