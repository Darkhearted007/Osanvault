import { db } from 'hatchable';
export const access='admin'; export const methods=['POST'];
export default async function(req,res){
  const {candidate_id,offer_id,start_date,tasks=[]}=req.body||{};
  if(!candidate_id)return res.status(400).json({ok:false,error:'candidate_id is required'});
  const c=await db.query(`SELECT id FROM job_candidates WHERE id=$1`,[candidate_id]);
  if(!c.rows.length)return res.status(404).json({ok:false,error:'Candidate not found'});
  let resolvedOffer=null;
  if(offer_id){
    const o=await db.query(`SELECT id,offer_status,proposed_start_date FROM employment_offers WHERE id=$1 AND candidate_id=$2`,[offer_id,candidate_id]);
    if(!o.rows.length)return res.status(404).json({ok:false,error:'Offer not found for candidate'});
    if(o.rows[0].offer_status!=='accepted')return res.status(409).json({ok:false,error:'Onboarding requires an accepted offer'});
    resolvedOffer=o.rows[0];
  }else{
    const o=await db.query(`SELECT id,offer_status,proposed_start_date FROM employment_offers WHERE candidate_id=$1 AND offer_status='accepted' ORDER BY created_at DESC LIMIT 1`,[candidate_id]);
    if(!o.rows.length)return res.status(409).json({ok:false,error:'Onboarding requires an accepted offer'});
    resolvedOffer=o.rows[0];
  }
  const existing=await db.query(`SELECT id FROM onboarding_cases WHERE candidate_id=$1 AND status NOT IN ('completed','cancelled') LIMIT 1`,[candidate_id]);
  if(existing.rows.length)return res.status(409).json({ok:false,error:'Active onboarding already exists',onboarding_id:existing.rows[0].id});
  const {rows}=await db.query(`INSERT INTO onboarding_cases(candidate_id,offer_id,start_date,status) VALUES($1,$2,$3,'in_progress') RETURNING *`,[candidate_id,resolvedOffer.id,start_date||resolvedOffer.proposed_start_date||null]);
  for(const t of (Array.isArray(tasks)?tasks:[])){if(t?.task_name)await db.query(`INSERT INTO onboarding_tasks(onboarding_id,task_name,required,due_date) VALUES($1,$2,$3,$4)`,[rows[0].id,String(t.task_name).trim(),t.required!==false,t.due_date||null]);}
  await db.query(`UPDATE job_candidates SET stage='onboarding',updated_at=now() WHERE id=$1`,[candidate_id]);
  res.status(201).json({ok:true,onboarding:rows[0]});
}