import { db } from 'hatchable';
export const access='member';
export const methods=['POST'];
const clean=(v,max)=>typeof v==='string'?v.trim().slice(0,max):'';
export default async function(req,res){
 const outcomeId=clean(req.body?.outcomeId,80);
 if(!outcomeId)return res.status(400).json({ok:false,error:'outcomeId is required.'});
 const q=await db.query(`SELECT o.id,o.profile_id,o.decision_id,o.outcome_score,o.verified,d.decision_score,p.owner_id,p.data_environment FROM economic_execution_outcomes o JOIN economic_explainable_decisions d ON d.id=o.decision_id JOIN economic_onboarding_profiles p ON p.id=o.profile_id WHERE o.id=$1 AND o.verified=true AND p.owner_id=$2 AND p.data_environment='production' LIMIT 1`,[outcomeId,req.member.id]);
 if(!q.rows.length)return res.status(404).json({ok:false,error:'Verified outcome not found in an owned production profile.'});
 const x=q.rows[0], predicted=Number(x.decision_score||0), actual=Number(x.outcome_score||0), gap=actual-predicted, abs=Math.abs(gap); const drift=abs>=30?'high':abs>=15?'moderate':'low';
 const recommendation=drift==='high'?'Review evidence weighting and decision calibration before any production model change.':drift==='moderate'?'Review recent signal contributions and consider controlled calibration testing.':'No immediate calibration change; continue monitoring verified outcomes.';
 const r=await db.query(`INSERT INTO economic_recalibration_runs(profile_id,outcome_id,decision_id,predicted_score,actual_outcome_score,accuracy_gap,drift_level,learning_recommendation,applied_to_production,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,false,$9) RETURNING id,profile_id AS "profileId",outcome_id AS "outcomeId",decision_id AS "decisionId",predicted_score AS "predictedScore",actual_outcome_score AS "actualOutcomeScore",accuracy_gap AS "accuracyGap",drift_level AS "driftLevel",learning_recommendation AS "learningRecommendation",applied_to_production AS "appliedToProduction",created_at AS "createdAt"`,[x.profile_id,x.id,x.decision_id,predicted,actual,gap,drift,recommendation,req.member.id]);
 res.status(201).json({ok:true,recalibration:r.rows[0],productionModelChanged:false,publicExposure:false,next:'calibration_review'});
}