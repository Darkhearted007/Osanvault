import { db } from 'hatchable';
export const access = 'public';
export const methods = ['POST'];
export default async function(req,res){
 const id=req.params.id,b=req.body||{}; if(!b.institutionId||!b.interestType)return res.status(400).json({error:'institutionId and interestType are required'});
 const r=await db.query('INSERT INTO project_capital_interests(project_id,institution_id,interest_type,amount,currency,message,status) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id,project_id AS "projectId",institution_id AS "institutionId",interest_type AS "interestType",amount,currency,message,status,created_at AS "createdAt"',[id,b.institutionId,b.interestType,b.amount||null,b.currency||'NGN',b.message||null,'submitted']);
 res.status(201).json({ ...r.rows[0], notice:'Non-binding expression of interest. No funds are accepted through this endpoint.' });
}