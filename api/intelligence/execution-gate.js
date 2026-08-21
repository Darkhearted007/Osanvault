import { db } from 'hatchable';
export const access='member';
export const methods=['POST'];
const clean=(v,max)=>typeof v==='string'?v.trim().slice(0,max):'';
export default async function(req,res){
 const decisionId=clean(req.body?.decisionId,80), action=clean(req.body?.action,30).toLowerCase(), key=clean(req.body?.executionKey,160), notes=clean(req.body?.notes,2000);
 if(!decisionId||!action)return res.status(400).json({ok:false,error:'decisionId and action are required.'});
 const q=await db.query(`SELECT d.id,d.profile_id,d.auto_execution_allowed,p.owner_id,p.data_environment FROM economic_explainable_decisions d JOIN economic_onboarding_profiles p ON p.id=d.profile_id WHERE d.id=$1 AND p.owner_id=$2 AND p.data_environment='production' LIMIT 1`,[decisionId,req.member.id]);
 if(!q.rows.length)return res.status(404).json({ok:false,error:'Decision not found in an owned production profile.'});
 const d=q.rows[0];
 if(d.auto_execution_allowed)return res.status(409).json({ok:false,error:'Decision execution policy is invalid: automatic execution must remain disabled.'});
 const a=await db.query(`SELECT id,status,requested_by FROM economic_governed_approvals WHERE decision_id=$1 AND status='approved' ORDER BY reviewed_at DESC LIMIT 1`,[decisionId]);
 if(!a.rows.length)return res.status(403).json({ok:false,error:'Execution locked: independent governance approval is required.'});
 const approval=a.rows[0];
 if(action==='queue'){
  if(!key)return res.status(400).json({ok:false,error:'executionKey is required for idempotent queueing.'});
  const prior=await db.query(`SELECT id,status,execution_key AS "executionKey" FROM economic_execution_gate WHERE execution_key=$1 LIMIT 1`,[key]);
  if(prior.rows.length)return res.json({ok:true,execution:prior.rows[0],idempotent:true,executionLocked:prior.rows[0].status!=='completed',publicExposure:false});
  const r=await db.query(`INSERT INTO economic_execution_gate(decision_id,profile_id,approval_id,execution_key,status,requested_by) VALUES($1,$2,$3,$4,'queued',$5) RETURNING id,decision_id AS "decisionId",approval_id AS "approvalId",execution_key AS "executionKey",status,requested_by AS "requestedBy",created_at AS "createdAt"`,[decisionId,d.profile_id,approval.id,key,req.member.id]);
  await db.query(`INSERT INTO economic_execution_events(execution_id,decision_id,profile_id,event_type,actor_id,from_status,to_status,notes) VALUES($1,$2,$3,'queue',$4,NULL,'queued',$5)`,[r.rows[0].id,decisionId,d.profile_id,req.member.id,notes]);
  return res.status(201).json({ok:true,execution:r.rows[0],executionLocked:false,publicExposure:false,next:'controlled_execution'});
 }
 const e=await db.query(`SELECT id,status,execution_key,requested_by FROM economic_execution_gate WHERE decision_id=$1 ORDER BY created_at DESC LIMIT 1`,[decisionId]);
 if(!e.rows.length)return res.status(404).json({ok:false,error:'Execution request not found.'});
 const x=e.rows[0];
 if(x.requested_by===req.member.id&&action==='start')return res.status(403).json({ok:false,error:'Execution requester cannot self-authorize start.'});
 let next;
 if(action==='start'&&x.status==='queued')next='in_progress';
 else if(action==='complete'&&x.status==='in_progress')next='completed';
 else if(action==='cancel'&&['queued','in_progress'].includes(x.status))next='cancelled';
 else return res.status(409).json({ok:false,error:`Invalid execution transition: ${x.status} -> ${action}.`});
 const r=await db.query(`UPDATE economic_execution_gate SET status=$1,executed_by=CASE WHEN $1 IN ('in_progress','completed') THEN $2 ELSE executed_by END,cancellation_reason=CASE WHEN $1='cancelled' THEN $3 ELSE cancellation_reason END,started_at=CASE WHEN $1='in_progress' THEN now() ELSE started_at END,completed_at=CASE WHEN $1 IN ('completed','cancelled') THEN now() ELSE completed_at END WHERE id=$4 RETURNING id,decision_id AS "decisionId",approval_id AS "approvalId",execution_key AS "executionKey",status,requested_by AS "requestedBy",executed_by AS "executedBy",cancellation_reason AS "cancellationReason",started_at AS "startedAt",completed_at AS "completedAt"`,[next,req.member.id,notes,x.id]);
 await db.query(`INSERT INTO economic_execution_events(execution_id,decision_id,profile_id,event_type,actor_id,from_status,to_status,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,[x.id,decisionId,d.profile_id,action,req.member.id,x.status,next,notes]);
 res.json({ok:true,execution:r.rows[0],executionLocked:next!=='in_progress',publicExposure:false,next:next==='completed'?'outcome_capture':next==='cancelled'?'post_execution_review':'controlled_execution'});
}