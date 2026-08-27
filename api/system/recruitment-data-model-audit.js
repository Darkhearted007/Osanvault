import { db } from 'hatchable';
export const access='admin';
export const methods=['GET'];
export default async function(req,res){
 const schema=(await db.query('SELECT current_schema() AS schema_name')).rows[0].schema_name;
 const c=(await db.query('SELECT COUNT(*)::int AS n FROM job_candidates')).rows[0].n;
 const o=(await db.query("SELECT COUNT(*)::int AS n FROM employment_offers WHERE offer_status=$1",['accepted'])).rows[0].n;
 const p=(await db.query('SELECT COUNT(*)::int AS n FROM people_records')).rows[0].n;
 const b=(await db.query('SELECT COUNT(*)::int AS n FROM onboarding_cases')).rows[0].n;
 const decision=o===0?'SAFE_NO_CONVERSION_CASE':'REVIEW_REQUIRED';
 const row=await db.query('INSERT INTO recruitment_data_model_audits(phase,schema_name,candidate_count,accepted_offer_count,people_record_count,onboarding_case_count,conversion_endpoint_access,decision,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id',['391.7',schema,c,o,p,b,'admin',decision,'Schema-backed audit; no business records created or mutated.']);
 res.status(200).json({phase:'391.7',auditId:row.rows[0].id,schema_name:schema,candidate_count:c,accepted_offer_count:o,people_record_count:p,onboarding_case_count:b,conversion_endpoint_access:'admin',decision,production_gate:'NOT_READY'});
}