import { db } from 'hatchable';
export const access='admin'; export const methods=['POST'];
export default async function(req,res){
  const {candidate_id,job_title,department,salary_amount,currency,start_date,position_id}=req.body||{};
  if(!candidate_id||!job_title)return res.status(400).json({ok:false,error:'candidate_id and job_title are required'});
  const c=await db.query(`SELECT id FROM job_candidates WHERE id=$1`,[candidate_id]);
  if(!c.rows.length)return res.status(404).json({ok:false,error:'Candidate not found'});
  const resolvedPosition=position_id||((await db.query(`SELECT position_id FROM recruitment_applications WHERE candidate_id=$1 AND position_id IS NOT NULL ORDER BY created_at DESC LIMIT 1`,[candidate_id])).rows[0]?.position_id||null);
  if(position_id){const p=await db.query(`SELECT id FROM org_positions WHERE id=$1`,[position_id]);if(!p.rows.length)return res.status(404).json({ok:false,error:'Position not found'});}
  const active=await db.query(`SELECT id FROM employment_offers WHERE candidate_id=$1 AND offer_status IN ('issued','accepted') ORDER BY created_at DESC LIMIT 1`,[candidate_id]);
  if(active.rows.length)return res.status(409).json({ok:false,error:'Candidate already has an active employment offer',offer_id:active.rows[0].id});
  const amount=salary_amount===''||salary_amount==null?null:Number(salary_amount);
  if(amount!==null&&(!Number.isFinite(amount)||amount<0))return res.status(400).json({ok:false,error:'salary_amount must be a non-negative number'});
  const {rows}=await db.query(`INSERT INTO employment_offers(candidate_id,position_id,offer_status,proposed_start_date,salary_amount,salary_currency,employment_type,notes) VALUES($1,$2,'issued',$3,$4,$5,'full_time',$6) RETURNING *`,[candidate_id,resolvedPosition,start_date||null,amount,currency||'NGN',`Role: ${job_title}; Department: ${department||'—'}`]);
  await db.query(`UPDATE job_candidates SET stage='offer',updated_at=now() WHERE id=$1`,[candidate_id]);
  res.status(201).json({ok:true,offer:rows[0],job_title,department,position_id:resolvedPosition});
}