import { db } from 'hatchable';
export const access='admin'; export const methods=['GET','POST','PUT'];
export default async function(req,res){
 if(req.method==='GET'){const {rows}=await db.query('SELECT * FROM corporate_resolutions ORDER BY resolution_date DESC NULLS LAST, created_at DESC'); return res.json(rows);}
 const b=req.body||{};
 if(!b.resolution_title||!b.resolution_type||!b.decision_summary) return res.status(400).json({error:'resolution_title, resolution_type and decision_summary are required'});
 const vals=[b.resolution_title,b.resolution_type,b.decision_summary,b.authority_basis||null,b.approval_status||'Draft',b.resolution_date||null,b.effective_date||null,b.implementation_owner||null,b.reference_number||null];
 if(req.method==='POST'){const {rows}=await db.query('INSERT INTO corporate_resolutions (resolution_title,resolution_type,decision_summary,authority_basis,approval_status,resolution_date,effective_date,implementation_owner,reference_number) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *',vals); return res.status(201).json(rows[0]);}
 if(!b.id)return res.status(400).json({error:'id is required for update'});
 const {rows}=await db.query('UPDATE corporate_resolutions SET resolution_title=$1,resolution_type=$2,decision_summary=$3,authority_basis=$4,approval_status=$5,resolution_date=$6,effective_date=$7,implementation_owner=$8,reference_number=$9,updated_at=now() WHERE id=$10 RETURNING *',[...vals,b.id]); if(!rows.length)return res.status(404).json({error:'resolution not found'}); return res.json(rows[0]);
}