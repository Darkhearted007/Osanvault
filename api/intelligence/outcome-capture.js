import { db } from 'hatchable';
export const access='member';
export const methods=['POST'];
const clean=(v,max)=>typeof v==='string'?v.trim().slice(0,max):'';
export default async function(req,res){
 const executionId=clean(req.body?.executionId,80), action=clean(req.body?.action,30).toLowerCase(), summary=clean(req.body?.summary,3000);
 const score=req.body?.outcomeScore===undefined?null:Number(req.body.outcomeScore);
 if(!executionId||!['record','verify','reject'].includes(action))return res.status(400).json({ok:false,error:'executionId and action record/verify/reject are required.'});
 if(action==='record'&&(!summary||score===null||!Number.isFinite(score)||score<0||score>100))return res.status(400).json({ok:false,error:'Outcome summary and score between 0 and 100 are required.'});
 const q=await db.query(`SELECT e.id,e.decision_id,e.profile_id,e.status,e.executed_by,p.owner_id,p.data_environment FROM economic_execution_gate e JOIN economic_onboarding_profiles p ON p.id=e.profile_id WHERE e.id=$1 AND p.owner_id=$2 AND p.data_environment='production' LIMIT 1`,[executionId,req.member.id]);
 if(!q.rows.length)return res.status(404).json({ok:false,error:'Execution not found in an owned production profile.'});
 const e=q.rows[0];
 if(!['completed','cancelled'].includes(e.status))return res.status(409).json({ok:false,error:'Outcome can only be captured after execution completes or is cancelled.'});
 const existing=await db.query(`SELECT id,outcome_status,verified,recorded_by FROM economic_execution_outcomes WHERE execution_id=$1 ORDER BY created_at DESC LIMIT 1`,[executionId]);
 const current=existing.rows[0];
 if(action==='record'){
  if(current&&current.outcome_status==='recorded')return res.status(409).json({ok:false,error:'Outcome already recorded.'});
  const r=await db.query(`INSERT INTO economic_execution_outcomes(execution_id,decision_id,profile_id,outcome_status,outcome_summary,outcome_score,recorded_by) VALUES($1,$2,$3,'recorded',$4,$5,$6) RETURNING id,execution_id AS "executionId",decision_id AS "decisionId",profile_id AS "profileId",outcome_status AS "outcomeStatus",outcome_summary AS "outcomeSummary",outcome_score AS "outcomeScore",verified,recorded_by AS "recordedBy",created_at AS "createdAt"`,[executionId,e.decision_id,e.profile_id,summary,score,req.member.id]);
  return res.status(201).json({ok:true,outcome:r.rows[0],trustedFeedback:false,publicExposure:false,next:'outcome_verification'});
 }
 if(!current)return res.status(404).json({ok:false,error:'Outcome record not found.'});
 if(current.recorded_by===req.member.id)return res.status(403).json({ok:false,error:'Separation of duties: outcome recorder cannot verify the same outcome.'});
 const next=action==='verify'?'verified':'rejected';
 const r=await db.query(`UPDATE economic_execution_outcomes SET outcome_status=$1,verified=$2,verified_by=$3,verified_at=now() WHERE id=$4 RETURNING id,execution_id AS "executionId",outcome_status AS "outcomeStatus",outcome_summary AS "outcomeSummary",outcome_score AS "outcomeScore",verified,recorded_by AS "recordedBy",verified_by AS "verifiedBy",verified_at AS "verifiedAt"`,[next,next==='verified',req.member.id,current.id]);
 if(next==='verified')await db.query(`INSERT INTO economic_learning_feedback(outcome_id,profile_id,feedback_type,signal_delta,learning_summary,trusted,created_by) VALUES($1,$2,'verified_outcome',$3,$4,true,$5)`,[current.id,e.profile_id,0,`Verified outcome recorded at score ${Number(current.outcome_score||0).toFixed(2)}; available for controlled recalibration.`,req.member.id]);
 res.json({ok:true,outcome:r.rows[0],trustedFeedback:next==='verified',publicExposure:false,next:next==='verified'?'recalibration':'outcome_review'});
}