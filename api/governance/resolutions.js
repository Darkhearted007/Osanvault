import { db } from 'hatchable';
export const access='admin'; export const methods=['POST'];
export default async function(req,res){
 const b=req.body||{}; if(!b.resolution_number||!b.title||!b.resolution_type) return res.status(400).json({error:'resolution_number, title and resolution_type are required'});
 const {rows}=await db.query('INSERT INTO corporate_resolutions (resolution_number,resolution_type,title,proposed_date,effective_date,status,decision_summary,supporting_document,recorded_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *',[b.resolution_number,b.resolution_type,b.title,b.proposed_date||new Date().toISOString().slice(0,10),b.effective_date||null,b.status||'Draft',b.decision_summary||null,b.supporting_document||null,b.recorded_by||null]); res.status(201).json(rows[0]);
}