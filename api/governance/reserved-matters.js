import { db } from 'hatchable';
export const access='admin';
export const methods=['GET','POST','PUT'];
export default async function(req,res){
 if(req.method==='GET'){
  const {rows}=await db.query('SELECT id,matter_code,category,matter_title,approval_authority,decision_standard,secondary_approval,notes,status FROM governance_reserved_matters ORDER BY category,matter_code');
  return res.json(rows);
 }
 const b=req.body||{};
 if(!b.matter_code||!b.category||!b.matter_title||!b.approval_authority||!b.decision_standard) return res.status(400).json({error:'matter_code, category, matter_title, approval_authority and decision_standard are required'});
 if(req.method==='POST'){
  const {rows}=await db.query('INSERT INTO governance_reserved_matters (matter_code,category,matter_title,approval_authority,decision_standard,secondary_approval,notes,status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',[b.matter_code,b.category,b.matter_title,b.approval_authority,b.decision_standard,b.secondary_approval||null,b.notes||null,b.status||'Active']);
  return res.status(201).json(rows[0]);
 }
 if(!b.id) return res.status(400).json({error:'id is required for update'});
 const {rows}=await db.query('UPDATE governance_reserved_matters SET category=$1,matter_title=$2,approval_authority=$3,decision_standard=$4,secondary_approval=$5,notes=$6,status=$7,updated_at=now() WHERE id=$8 RETURNING *',[b.category,b.matter_title,b.approval_authority,b.decision_standard,b.secondary_approval||null,b.notes||null,b.status||'Active',b.id]);
 if(!rows.length) return res.status(404).json({error:'reserved matter not found'});
 return res.json(rows[0]);
}