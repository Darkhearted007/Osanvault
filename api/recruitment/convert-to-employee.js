import { db } from 'hatchable';
export const access='admin';
export const methods=['POST'];
export default async function(req,res){
  const {candidate_id}=req.body||{};
  if(!candidate_id)return res.status(400).json({ok:false,error:'candidate_id is required'});
  const q=await db.query(`SELECT c.*,o.id offer_id,o.position_id,o.salary_amount,o.salary_currency,o.proposed_start_date
    FROM job_candidates c
    JOIN employment_offers o ON o.candidate_id=c.id AND o.offer_status='accepted'
    WHERE c.id=$1 ORDER BY o.created_at DESC LIMIT 1`,[candidate_id]);
  if(!q.rows.length){
    const c=await db.query(`SELECT id FROM job_candidates WHERE id=$1`,[candidate_id]);
    if(!c.rows.length)return res.status(404).json({ok:false,error:'Candidate not found'});
    return res.status(409).json({ok:false,error:'Candidate must have an accepted offer before conversion'});
  }
  const c=q.rows[0];
  if(!c.email)return res.status(409).json({ok:false,error:'Candidate email is required before conversion'});
  const existing=await db.query(`SELECT id FROM people_records WHERE lower(email)=lower($1) LIMIT 1`,[c.email]);
  if(existing.rows.length)return res.status(409).json({ok:false,error:'A people record already exists for this email',person_id:existing.rows[0].id});
  const onboard=await db.query(`SELECT id FROM onboarding_cases WHERE candidate_id=$1 AND status NOT IN ('completed','cancelled') LIMIT 1`,[candidate_id]);
  const statements=[
    {sql:`INSERT INTO people_records(full_name,email,position_id,person_type,lifecycle_status) VALUES($1,$2,$3,'employee','onboarding') RETURNING id,full_name,email,position_id,person_type,lifecycle_status`,params:[c.full_name,c.email,c.position_id||null]},
    {sql:`INSERT INTO employee_compensation(person_id,effective_from,salary_amount,currency,pay_frequency,allowances,status,notes) SELECT id,$2,$3,$4,'monthly',0,'pending','Created from accepted employment offer; pending onboarding approval' FROM people_records WHERE lower(email)=lower($1) ORDER BY created_at DESC LIMIT 1`,params:[c.email,c.proposed_start_date||new Date().toISOString().slice(0,10),c.salary_amount??null,c.salary_currency||'NGN']},
    {sql:`UPDATE job_candidates SET stage='hired',updated_at=now() WHERE id=$1`,params:[candidate_id]}
  ];
  if(onboard.rows.length)statements.push({sql:`UPDATE onboarding_cases SET status='in_progress',completed_at=NULL,offer_id=$2,start_date=$3 WHERE id=$1`,params:[onboard.rows[0].id,c.offer_id,c.proposed_start_date||null]});
  else statements.push({sql:`INSERT INTO onboarding_cases(candidate_id,offer_id,start_date,status) VALUES($1,$2,$3,'in_progress')`,params:[candidate_id,c.offer_id,c.proposed_start_date||null]});
  const tx=await db.transaction(statements);
  const person=tx.results[0].rows[0];
  res.status(201).json({ok:true,employee:person,compensation_created:true,onboarding_status:'in_progress',membership_provisioned:false,role_provisioned:false});
}