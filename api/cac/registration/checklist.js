import { db } from 'hatchable';
export const access='admin';
export const methods=['GET','POST'];
export default async function(req,res){
  const caseId=req.query.caseId||req.body?.caseId;
  if(!caseId) return res.status(400).json({error:'caseId is required'});
  if(req.method==='GET'){
    const {rows}=await db.query(`SELECT * FROM cac_registration_checklist WHERE case_id=$1 ORDER BY category,title`,[caseId]);
    return res.json(rows);
  }
  const {code,status,notes}=req.body||{};
  if(!code || !['pending','in_progress','complete','blocked','not_applicable'].includes(status)) return res.status(400).json({error:'code and valid status are required'});
  const {rows}=await db.query(`UPDATE cac_registration_checklist SET status=$1,notes=$2,completed_by=CASE WHEN $1='complete' THEN $3 ELSE completed_by END,completed_at=CASE WHEN $1='complete' THEN now() ELSE completed_at END WHERE case_id=$4 AND code=$5 RETURNING *`,[status,notes||null,req.member?.id||null,caseId,code]);
  if(!rows.length) return res.status(404).json({error:'Checklist item not found'});
  await db.query(`INSERT INTO cac_registration_events (case_id,event_type,actor_id,details) VALUES ($1,'checklist_updated',$2,$3)`,[caseId,req.member?.id||null,JSON.stringify({code,status})]);
  return res.json(rows[0]);
}