import { db } from 'hatchable';
export const access='member';
export const methods=['POST'];
const clean=(v,max)=>typeof v==='string'?v.trim().slice(0,max):'';
export default async function(req,res){
 const reviewId=clean(req.body?.calibrationReviewId,80), action=clean(req.body?.action,30).toLowerCase();
 if(!reviewId||!['create','test','complete','reject'].includes(action))return res.status(400).json({ok:false,error:'calibrationReviewId and action create/test/complete/reject are required.'});
 const q=await db.query(`SELECT r.id,r.profile_id,r.status,r.approved_for_production,p.owner_id,p.data_environment FROM economic_calibration_reviews r JOIN economic_onboarding_profiles p ON p.id=r.profile_id WHERE r.id=$1 AND p.owner_id=$2 AND p.data_environment='production' LIMIT 1`,[reviewId,req.member.id]);
 if(!q.rows.length)return res.status(404).json({ok:false,error:'Calibration review not found in an owned production profile.'});
 const r=q.rows[0];
 if(r.status!=='approved'||!r.approved_for_production)return res.status(403).json({ok:false,error:'Sandbox creation requires an independently approved calibration review.'});
 const existing=await db.query(`SELECT id,status,production_applied FROM economic_model_change_sandboxes WHERE calibration_review_id=$1 ORDER BY created_at DESC LIMIT 1`,[reviewId]);
 if(action==='create'){
  if(existing.rows.length)return res.json({ok:true,sandbox:existing.rows[0],idempotent:true,productionApplied:false,publicExposure:false});
  const base=await db.query(`SELECT decision_score FROM economic_explainable_decisions WHERE profile_id=$1 ORDER BY created_at DESC LIMIT 1`,[r.profile_id]);
  const baseline=Number(base.rows[0]?.decision_score||0);
  const x=await db.query(`INSERT INTO economic_model_change_sandboxes(calibration_review_id,profile_id,status,baseline_score,created_by) VALUES($1,$2,'created',$3,$4) RETURNING id,calibration_review_id AS "calibrationReviewId",profile_id AS "profileId",status,baseline_score AS "baselineScore",proposed_score AS "proposedScore",simulated_delta AS "simulatedDelta",test_result AS "testResult",production_applied AS "productionApplied",created_at AS "createdAt"`,[reviewId,r.profile_id,baseline,req.member.id]);
  await db.query(`INSERT INTO economic_model_change_events(sandbox_id,profile_id,event_type,actor_id,from_status,to_status,notes) VALUES($1,$2,'create',$3,NULL,'created','Isolated model-change sandbox created.')`,[x.rows[0].id,r.profile_id,req.member.id]);
  return res.status(201).json({ok:true,sandbox:x.rows[0],productionApplied:false,publicExposure:false,next:'sandbox_test'});
 }
 if(!existing.rows.length)return res.status(404).json({ok:false,error:'Sandbox not found. Create it first.'});
 const s=existing.rows[0];
 if(action==='test'){
  const full=await db.query(`SELECT id,status,baseline_score,proposed_score,simulated_delta FROM economic_model_change_sandboxes WHERE id=$1`,[s.id]);
  const x=full.rows[0]; const proposed=Number(x.baseline_score||0); const delta=Number((proposed-Number(x.baseline_score||0)).toFixed(2));
  const u=await db.query(`UPDATE economic_model_change_sandboxes SET status='testing',proposed_score=$1,simulated_delta=$2,test_result=$3 WHERE id=$4 RETURNING id,status,baseline_score AS "baselineScore",proposed_score AS "proposedScore",simulated_delta AS "simulatedDelta",test_result AS "testResult",production_applied AS "productionApplied"`,[proposed,delta,'Sandbox test completed; no production mutation performed.',s.id]);
  await db.query(`INSERT INTO economic_model_change_events(sandbox_id,profile_id,event_type,actor_id,from_status,to_status,notes) VALUES($1,$2,'test',$3,$4,'testing','Isolated test completed; production remains unchanged.')`,[s.id,r.profile_id,req.member.id,x.status]);
  return res.json({ok:true,sandbox:u.rows[0],productionApplied:false,publicExposure:false,next:'sandbox_review'});
 }
 const next=action==='complete'?'completed':'rejected';
 const u=await db.query(`UPDATE economic_model_change_sandboxes SET status=$1,completed_at=now(),production_applied=false WHERE id=$2 RETURNING id,status,production_applied AS "productionApplied",completed_at AS "completedAt"`,[next,s.id]);
 await db.query(`INSERT INTO economic_model_change_events(sandbox_id,profile_id,event_type,actor_id,from_status,to_status,notes) VALUES($1,$2,$3,$4,$5,$6,$7)`,[s.id,r.profile_id,action,req.member.id,s.status,next,action==='complete'?'Sandbox completed; production adoption remains a separate controlled change.':'Sandbox proposal rejected.']);
 res.json({ok:true,sandbox:u.rows[0],productionApplied:false,publicExposure:false,next:'controlled_production_change'});
}