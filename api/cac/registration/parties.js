import { db } from 'hatchable';
export const access='admin';
export const methods=['GET','POST'];
export default async function(req,res){
  const caseId=req.query.caseId||req.body?.caseId;
  if(!caseId) return res.status(400).json({error:'caseId is required'});
  if(req.method==='GET'){
    const {rows}=await db.query(`SELECT * FROM cac_registration_parties WHERE case_id=$1 ORDER BY created_at`,[caseId]);
    return res.json(rows);
  }
  const b=req.body||{};
  if(!b.partyType||!b.fullName) return res.status(400).json({error:'partyType and fullName are required'});
  const {rows}=await db.query(`INSERT INTO cac_registration_parties (case_id,party_type,full_name,email,phone,nationality,occupation,address,share_allocation,id_status,consent_status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,[caseId,b.partyType,b.fullName,b.email||null,b.phone||null,b.nationality||null,b.occupation||null,b.address||null,b.shareAllocation||null,b.idStatus||'pending',b.consentStatus||'pending']);
  return res.status(201).json(rows[0]);
}