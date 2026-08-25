import { db } from 'hatchable';

export const access = 'admin';
export const methods = ['GET','POST'];

export default async function(req,res){
  if(req.method==='GET'){
    const q=await db.query("SELECT * FROM gis_phase3865_review_queue WHERE status='OPEN' ORDER BY CASE priority WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3 END,created_at LIMIT 200");
    return res.json({phase:'386.5',count:q.rows.length,items:q.rows,certificationRemainsBlocked:true});
  }
  const b=req.body||{};
  if(!b.source_feature_id||!b.reviewer_decision)return res.status(400).json({error:'source_feature_id and reviewer_decision are required'});
  const allowed=['APPROVE','REJECT','QUARANTINE','DEFER'];
  if(!allowed.includes(b.reviewer_decision))return res.status(400).json({error:'Invalid reviewer_decision'});
  const q=await db.query("UPDATE gis_phase3865_review_queue SET status=$1,reviewer_id=$2,reviewer_decision=$3,rationale=$4,reviewed_at=now(),updated_at=now() WHERE source_feature_id=$5 AND status='OPEN' RETURNING id,source_feature_id,status,reviewer_decision",[b.reviewer_decision==='APPROVE'?'APPROVED':b.reviewer_decision==='REJECT'?'REJECTED':b.reviewer_decision==='QUARANTINE'?'QUARANTINED':'DEFERRED',b.reviewer_id||null,b.reviewer_decision,b.rationale||null,b.source_feature_id]);
  if(!q.rows.length)return res.status(404).json({error:'Open review item not found'});
  return res.json({phase:'386.5',review:q.rows[0],certificationRemainsBlocked:true});
}