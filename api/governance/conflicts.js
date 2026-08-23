import { db } from 'hatchable';
export const access='admin'; export const methods=['GET','POST','PUT'];
export default async function(req,res){
 if(req.method==='GET'){const {rows}=await db.query('SELECT * FROM governance_conflicts ORDER BY disclosure_date DESC NULLS LAST, created_at DESC'); return res.json(rows);}
 const b=req.body||{};
 if(!b.subject_name||!b.conflict_type||!b.description) return res.status(400).json({error:'subject_name, conflict_type and description are required'});
 const vals=[b.subject_name,b.role_or_relationship||null,b.conflict_type,b.description,b.mitigation||null,b.status||'Open',b.disclosure_date||null,b.review_date||null];
 if(req.method==='POST'){const {rows}=await db.query('INSERT INTO governance_conflicts (subject_name,role_or_relationship,conflict_type,description,mitigation,status,disclosure_date,review_date) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',vals); return res.status(201).json(rows[0]);}
 if(!b.id)return res.status(400).json({error:'id is required for update'});
 const {rows}=await db.query('UPDATE governance_conflicts SET subject_name=$1,role_or_relationship=$2,conflict_type=$3,description=$4,mitigation=$5,status=$6,disclosure_date=$7,review_date=$8,updated_at=now() WHERE id=$9 RETURNING *',[...vals,b.id]); if(!rows.length)return res.status(404).json({error:'conflict not found'}); return res.json(rows[0]);
}