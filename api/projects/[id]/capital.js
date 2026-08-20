import { db } from 'hatchable';
export const access = 'member';
export const methods = ['GET','POST'];
export default async function(req,res){
 const id=req.params.id;
 if(req.method==='GET'){
  const [r,s,i]=await Promise.all([
   db.query('SELECT id,amount,currency,purpose,financing_stage AS "financingStage",target_date AS "targetDate",status,created_at AS "createdAt" FROM project_capital_requests WHERE project_id=$1 ORDER BY created_at DESC',[id]),
   db.query('SELECT id,source_type AS "sourceType",name,mandate,status,notes FROM project_capital_sources WHERE project_id=$1 ORDER BY created_at DESC',[id]),
   db.query('SELECT id,instrument_type AS "instrumentType",amount,currency,terms_summary AS "termsSummary",status FROM project_capital_instruments WHERE project_id=$1 ORDER BY created_at DESC',[id])
  ]); return res.json({capitalRequests:r.rows,sources:s.rows,instruments:i.rows});
 }
 const b=req.body||{}; if(!b.amount||!b.purpose)return res.status(400).json({error:'amount and purpose are required'});
 const r=await db.query('INSERT INTO project_capital_requests(project_id,amount,currency,purpose,financing_stage,target_date,status) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id,amount,currency,purpose,financing_stage AS "financingStage",target_date AS "targetDate",status',[id,b.amount,b.currency||'NGN',b.purpose,b.financingStage||'pre_development',b.targetDate||null,'draft']);
 res.status(201).json(r.rows[0]);
}