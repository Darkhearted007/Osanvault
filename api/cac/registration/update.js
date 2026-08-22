import { db } from 'hatchable';
export const access='admin';
export const methods=['POST'];
export default async function(req,res){
  const b=req.body||{};
  if(!b.caseId) return res.status(400).json({error:'caseId is required'});
  const fields=['status','shareCapital','registeredOffice','nameReservationStatus','cacSubmissionReference','cacQuery'];
  const map={status:'status',shareCapital:'share_capital',registeredOffice:'registered_office',nameReservationStatus:'name_reservation_status',cacSubmissionReference:'cac_submission_reference',cacQuery:'cac_query'};
  const sets=[],params=[]; let i=1;
  for(const f of fields) if(b[f]!==undefined){sets.push(`${map[f]}=$${i++}`);params.push(b[f]);}
  if(!sets.length) return res.status(400).json({error:'No fields supplied'});
  params.push(b.caseId);
  const {rows}=await db.query(`UPDATE cac_registration_cases SET ${sets.join(',')},updated_at=now() WHERE id=$${i} RETURNING *`,params);
  if(!rows.length) return res.status(404).json({error:'Case not found'});
  await db.query(`INSERT INTO cac_registration_events (case_id,event_type,actor_id,details) VALUES ($1,'case_updated',$2,$3)`,[b.caseId,req.member?.id||null,JSON.stringify(b)]);
  return res.json(rows[0]);
}