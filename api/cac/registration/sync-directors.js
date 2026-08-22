import { db } from 'hatchable';
export const access='admin';
export const methods=['POST'];
export default async function(req,res){
 const {caseId}=req.body||{};
 if(!caseId) return res.status(400).json({error:'caseId is required'});
 const {rows:directors}=await db.query(`SELECT id,full_name,email,status,consent_status,date_of_birth,nationality,occupation,residential_address,service_address,phone,id_document_status,consented_at FROM cac_director_profiles ORDER BY created_at`);
 if(!directors.length) return res.json({ok:true,directors:[],updated:[]});
 const allConsented=directors.every(d=>d.consent_status==='consented' || d.consent_status==='accepted');
 const allIdentity=directors.every(d=>d.id_document_status==='verified' || d.id_document_status==='approved' || d.id_document_status==='complete');
 const allParticulars=directors.every(d=>d.date_of_birth && d.nationality && d.occupation && d.residential_address && d.service_address && d.phone);
 const updates=[
  ['directors',allConsented&&allParticulars?'complete':'in_progress'],
  ['identity_documents',allIdentity?'complete':'in_progress'],
  ['director_consent',allConsented?'complete':'in_progress']
 ];
 for(const [code,status] of updates){
  await db.query(`UPDATE cac_registration_checklist SET status=$1,notes=$2,completed_by=$3,completed_at=CASE WHEN $1='complete' THEN now() ELSE completed_at END WHERE case_id=$4 AND code=$5`,[status,`Auto-synced from CAC Director Onboarding. ${directors.length} director profile(s) checked.`,req.member?.id||null,caseId,code]);
  await db.query(`INSERT INTO cac_registration_events (case_id,event_type,actor_id,details) VALUES ($1,'director_readiness_synced',$2,$3)`,[caseId,req.member?.id||null,JSON.stringify({code,status,directorCount:directors.length})]);
 }
 return res.json({ok:true,directors,readiness:{consent:allConsented,identity:allIdentity,particulars:allParticulars},updated:updates});
}