import { db } from 'hatchable';
export const access='admin'; export const methods=['GET','POST','PUT'];
export default async function(req,res){
 if(req.method==='GET'){const {rows}=await db.query('SELECT * FROM stakeholder_interests ORDER BY country_code NULLS LAST, name_or_identifier'); return res.json(rows);}
 const b=req.body||{};
 if(!b.stakeholder_type||!b.name_or_identifier||!b.interest_category) return res.status(400).json({error:'stakeholder_type, name_or_identifier and interest_category are required'});
 const vals=[b.stakeholder_type,b.name_or_identifier,b.jurisdiction_region||null,b.country_code||null,b.interest_category,b.legal_or_evidence_reference||null,b.verification_status||'Pending',b.notes||null];
 if(req.method==='POST'){const {rows}=await db.query('INSERT INTO stakeholder_interests (stakeholder_type,name_or_identifier,jurisdiction_region,country_code,interest_category,legal_or_evidence_reference,verification_status,notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',vals); return res.status(201).json(rows[0]);}
 if(!b.id)return res.status(400).json({error:'id is required for update'});
 const {rows}=await db.query('UPDATE stakeholder_interests SET stakeholder_type=$1,name_or_identifier=$2,jurisdiction_region=$3,country_code=$4,interest_category=$5,legal_or_evidence_reference=$6,verification_status=$7,notes=$8,updated_at=now() WHERE id=$9 RETURNING *',[...vals,b.id]); if(!rows.length)return res.status(404).json({error:'stakeholder interest not found'}); return res.json(rows[0]);
}