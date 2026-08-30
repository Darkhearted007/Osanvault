import { db } from 'hatchable';
export const access='admin';
export const methods=['POST'];
const clean=(v,max)=>typeof v==='string'?v.trim().slice(0,max):'';
export default async function(req,res){
 const recalibrationId=clean(req.body?.recalibrationId,80), action=clean(req.body?.action,30).toLowerCase(), notes=clean(req.body?.notes,2000);
 if(!recalibrationId||!['request','monitor','test','approve','reject'].includes(action))return res.status(400).json({ok:false,error:'recalibrationId and action request/monitor/test/approve/reject are required.'});
 const q=await db.query(`SELECT r.id,r.profile_id,r.drift_level,r.learning_recommendation,p.owner_id,p.data_environment FROM economic_recalibration_runs r JOIN economic_onboarding_profiles p ON p.id=r.profile_id WHERE r.id=$1 AND p.owner_id=$2 AND p.data_environment='production' LIMIT 1`,[recalibrationId,req.member.id]);
 if(!q.rows.length)return res.status(404).json({ok:false,error:'Recalibration run not found in an owned production profile.'});
 const r=q.rows[0]; const existing=await db.query(`SELECT id,status,requested_by FROM economic_calibration_reviews WHERE recalibration_id=$1 ORDER BY created_at DESC LIMIT 1`,[recalibrationId]); const current=existing.rows[0];
 if(action==='request'){
  if(current&&['pending','monitoring','testing','approved'].includes(current.status))return res.status(409).json({ok:false,error:'An active calibration review already exists.'});
  const x=await db.query(`INSERT INTO economic_calibration_reviews(recalibration_id,profile_id,status,requested_by,proposed_change) VALUES($1,$2,'pending',$3,$4) RETURNING id,recalibration_id AS "recalibrationId",profile_id AS "profileId",status,requested_by AS "requestedBy",proposed_change AS "proposedChange",created_at AS "createdAt"`,[recalibrationId,r.profile_id,req.member.id,JSON.stringify({recommendation:r.learning_recommendation,drift:r.drift_level})]);
  await db.query(`INSERT INTO economic_calibration_governance_events(review_id,recalibration_id,profile_id,event_type,actor_id,from_status,to_status,notes) VALUES($1,$2,$3,'request',$4,NULL,'pending',$5)`,[x.rows[0].id,recalibrationId,r.profile_id,req.member.id,notes]);
  return res.status(201).json({ok:true,review:x.rows[0],productionChangeLocked:true,publicExposure:false,next:'calibration_review'});
 }
 if(!current)return res.status(409).json({ok:false,error:'A calibration review must be requested first.'});
 if(['approve','reject'].includes(action)&&current.requested_by===req.member.id)return res.status(403).json({ok:false,error:'Separation of duties: requester cannot approve or reject the same calibration review.'});
 if(!['pending','monitoring','testing'].includes(current.status))return res.status(409).json({ok:false,error:`Calibration review is already ${current.status}.`});
 const next=action==='monitor'?'monitoring':action==='test'?'testing':action==='approve'?'approved':'rejected';
 const approved=next==='approved';
 const x=await db.query(`UPDATE economic_calibration_reviews SET status=$1,reviewer_id=$2,review_notes=$3,approved_for_production=$4,reviewed_at=CASE WHEN $5 THEN now() ELSE reviewed_at END WHERE id=$6 RETURNING id,recalibration_id AS "recalibrationId",profile_id AS "profileId",status,requested_by AS "requestedBy",reviewer_id AS "reviewerId",review_notes AS "reviewNotes",proposed_change AS "proposedChange",approved_for_production AS "approvedForProduction",reviewed_at AS "reviewedAt"`,[next,req.member.id,notes,approved,approved||next==='rejected',current.id]);
 await db.query(`INSERT INTO economic_calibration_governance_events(review_id,recalibration_id,profile_id,event_type,actor_id,from_status,to_status,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,[current.id,recalibrationId,r.profile_id,action,req.member.id,current.status,next,notes]);
 res.json({ok:true,review:x.rows[0],productionChangeLocked:true,publicExposure:false,next:approved?'controlled_model_change_review':next==='rejected'?'recalibration_monitoring':'calibration_review'});
}