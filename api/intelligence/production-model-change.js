import { db } from 'hatchable';
export const access='admin';
export const methods=['POST'];
const clean=(v,max)=>typeof v==='string'?v.trim().slice(0,max):'';
export default async function(req,res){
 const sandboxId=clean(req.body?.sandboxId,80), action=clean(req.body?.action,30).toLowerCase(), notes=clean(req.body?.notes,2000);
 if(!sandboxId||!['request','approve','apply','rollback','reject'].includes(action))return res.status(400).json({ok:false,error:'sandboxId and action request/approve/apply/rollback/reject are required.'});
 const q=await db.query(`SELECT s.id,s.profile_id,s.status,s.production_applied,s.baseline_score,s.proposed_score,r.status AS review_status,r.approved_for_production,p.owner_id,p.data_environment FROM economic_model_change_sandboxes s JOIN economic_calibration_reviews r ON r.id=s.calibration_review_id JOIN economic_onboarding_profiles p ON p.id=s.profile_id WHERE s.id=$1 AND p.owner_id=$2 AND p.data_environment='production' LIMIT 1`,[sandboxId,req.member.id]);
 if(!q.rows.length)return res.status(404).json({ok:false,error:'Sandbox not found in an owned production profile.'});
 const s=q.rows[0];
 if(s.review_status!=='approved'||!s.approved_for_production||s.status!=='completed'||s.production_applied)return res.status(403).json({ok:false,error:'Production change requires an approved calibration review and completed sandbox test.'});
 const existing=await db.query(`SELECT id,status,requested_by,approved_by,applied_by,baseline_score,proposed_score,rollback_snapshot FROM economic_production_model_changes WHERE sandbox_id=$1 ORDER BY created_at DESC LIMIT 1`,[sandboxId]);
 if(action==='request'){
  if(existing.rows.length)return res.json({ok:true,change:existing.rows[0],idempotent:true,productionChanged:false,publicExposure:false});
  const x=await db.query(`INSERT INTO economic_production_model_changes(sandbox_id,profile_id,status,requested_by,baseline_score,proposed_score,rollback_snapshot,change_reason) VALUES($1,$2,'pending',$3,$4,$5,$6,$7) RETURNING id,sandbox_id AS "sandboxId",profile_id AS "profileId",status,requested_by AS "requestedBy",baseline_score AS "baselineScore",proposed_score AS "proposedScore",rollback_snapshot AS "rollbackSnapshot",change_reason AS "changeReason",created_at AS "createdAt"`,[sandboxId,s.profile_id,req.member.id,s.baseline_score,s.proposed_score,JSON.stringify({baselineScore:s.baseline_score,sourceSandbox:sandboxId}),notes]);
  await db.query(`INSERT INTO economic_production_model_change_events(change_id,profile_id,event_type,actor_id,from_status,to_status,notes) VALUES($1,$2,'request',$3,NULL,'pending',$4)`,[x.rows[0].id,s.profile_id,req.member.id,notes]);
  return res.status(201).json({ok:true,change:x.rows[0],productionChanged:false,publicExposure:false,next:'independent_change_approval'});
 }
 if(!existing.rows.length)return res.status(404).json({ok:false,error:'Production change request not found.'});
 const c=existing.rows[0];
 if(action==='approve'){
  if(c.requested_by===req.member.id)return res.status(403).json({ok:false,error:'Separation of duties: requester cannot approve the production model change.'});
  if(c.status!=='pending')return res.status(409).json({ok:false,error:`Production change is already ${c.status}.`});
  const x=await db.query(`UPDATE economic_production_model_changes SET status='approved',approved_by=$1,approved_at=now() WHERE id=$2 RETURNING id,status,requested_by AS "requestedBy",approved_by AS "approvedBy",approved_at AS "approvedAt"`,[req.member.id,c.id]);
  await db.query(`INSERT INTO economic_production_model_change_events(change_id,profile_id,event_type,actor_id,from_status,to_status,notes) VALUES($1,$2,'approve',$3,'pending','approved',$4)`,[c.id,s.profile_id,req.member.id,notes]);
  return res.json({ok:true,change:x.rows[0],productionChanged:false,publicExposure:false,next:'controlled_apply'});
 }
 if(action==='apply'){
  if(c.status!=='approved')return res.status(409).json({ok:false,error:'Production model change must be independently approved before apply.'});
  if(c.approved_by===req.member.id)return res.status(403).json({ok:false,error:'A separate operator must apply an approved production change.'});
  const x=await db.query(`UPDATE economic_production_model_changes SET status='applied',applied_by=$1,applied_at=now() WHERE id=$2 RETURNING id,status,approved_by AS "approvedBy",applied_by AS "appliedBy",baseline_score AS "baselineScore",proposed_score AS "proposedScore",applied_at AS "appliedAt"`,[req.member.id,c.id]);
  await db.query(`INSERT INTO economic_production_model_change_events(change_id,profile_id,event_type,actor_id,from_status,to_status,notes) VALUES($1,$2,'apply',$3,'approved','applied',$4)`,[c.id,s.profile_id,req.member.id,notes]);
  return res.json({ok:true,change:x.rows[0],productionChanged:true,publicExposure:false,next:'post_change_monitoring'});
 }
 const next=action==='rollback'?'rolled_back':'rejected';
 if(action==='rollback'&&c.status!=='applied')return res.status(409).json({ok:false,error:'Rollback is only available after an applied production change.'});
 const x=await db.query(`UPDATE economic_production_model_changes SET status=$1,rolled_back_at=CASE WHEN $1='rolled_back' THEN now() ELSE rolled_back_at END WHERE id=$2 RETURNING id,status,rolled_back_at AS "rolledBackAt",rollback_snapshot AS "rollbackSnapshot"`,[next,c.id]);
 await db.query(`INSERT INTO economic_production_model_change_events(change_id,profile_id,event_type,actor_id,from_status,to_status,notes) VALUES($1,$2,$3,$4,$5,$6,$7)`,[c.id,s.profile_id,action,req.member.id,c.status,next,notes]);
 res.json({ok:true,change:x.rows[0],productionChanged:next==='rolled_back',publicExposure:false,next:next==='rolled_back'?'rollback_monitoring':'change_monitoring'});
}