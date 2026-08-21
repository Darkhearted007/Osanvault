import { db } from 'hatchable';
export const access='member';
export const methods=['POST'];
const clean=(v,max)=>typeof v==='string'?v.trim().slice(0,max):'';
export default async function(req,res){
 const decisionId=clean(req.body?.decisionId,80), action=clean(req.body?.action,30).toLowerCase(), notes=clean(req.body?.notes,2000);
 if(!decisionId||!['request','approve','reject','escalate'].includes(action))return res.status(400).json({ok:false,error:'decisionId and action request/approve/reject/escalate are required.'});
 const q=await db.query(`SELECT d.id,d.profile_id,d.decision_state,d.auto_execution_allowed,p.owner_id,p.data_environment FROM economic_explainable_decisions d JOIN economic_onboarding_profiles p ON p.id=d.profile_id WHERE d.id=$1 AND p.owner_id=$2 AND p.data_environment='production' LIMIT 1`,[decisionId,req.member.id]);
 if(!q.rows.length)return res.status(404).json({ok:false,error:'Decision not found in an owned production profile.'});
 const d=q.rows[0];
 const existing=await db.query(`SELECT id,status,requested_by,reviewer_id FROM economic_governed_approvals WHERE decision_id=$1 ORDER BY created_at DESC LIMIT 1`,[decisionId]);
 const current=existing.rows[0];
 if(action==='request'){
  if(current&&['pending','approved','escalated'].includes(current.status))return res.status(409).json({ok:false,error:'An active governance request already exists.'});
  const r=await db.query(`INSERT INTO economic_governed_approvals(decision_id,profile_id,status,requested_by) VALUES($1,$2,'pending',$3) RETURNING id,decision_id AS "decisionId",profile_id AS "profileId",status,requested_by AS "requestedBy",created_at AS "createdAt"`,[decisionId,d.profile_id,req.member.id]);
  await db.query(`INSERT INTO economic_governance_events(approval_id,decision_id,profile_id,event_type,actor_id,from_status,to_status,notes) VALUES($1,$2,$3,'request',$4,NULL,'pending',$5)`,[r.rows[0].id,decisionId,d.profile_id,req.member.id,notes]);
  return res.status(201).json({ok:true,approval:r.rows[0],executionLocked:true,publicExposure:false});
 }
 if(!current)return res.status(409).json({ok:false,error:'A governance request must exist before review.'});
 if(current.requested_by===req.member.id)return res.status(403).json({ok:false,error:'Separation of duties: requester cannot review the same decision.'});
 if(!['pending','escalated'].includes(current.status))return res.status(409).json({ok:false,error:`Approval is already ${current.status}.`});
 const next=action==='approve'?'approved':action==='reject'?'rejected':'escalated';
 const r=await db.query(`UPDATE economic_governed_approvals SET status=$1,reviewer_id=$2,review_notes=$3,reviewed_at=now() WHERE id=$4 RETURNING id,decision_id AS "decisionId",profile_id AS "profileId",status,requested_by AS "requestedBy",reviewer_id AS "reviewerId",review_notes AS "reviewNotes",reviewed_at AS "reviewedAt"`,[next,req.member.id,notes,current.id]);
 await db.query(`INSERT INTO economic_governance_events(approval_id,decision_id,profile_id,event_type,actor_id,from_status,to_status,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,[current.id,decisionId,d.profile_id,action,req.member.id,current.status,next,notes]);
 res.json({ok:true,approval:r.rows[0],executionLocked:next!=='approved',publicExposure:false,next:next==='approved'?'execution_gate':'governance_review'});
}