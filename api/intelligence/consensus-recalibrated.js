import { db } from 'hatchable';
export const access='member';
export const methods=['POST'];
const clean=v=>typeof v==='string'?v.trim().slice(0,80):'';
export default async function(req,res){
 const profileId=clean(req.body?.profileId);
 if(!profileId)return res.status(400).json({ok:false,error:'profileId is required.'});
 const p=await db.query(`SELECT id,display_name FROM economic_onboarding_profiles WHERE id=$1 AND owner_id=$2 AND data_environment='production' LIMIT 1`,[profileId,req.member.id]);
 if(!p.rows.length)return res.status(404).json({ok:false,error:'Production profile not found.'});
 const n=await db.query(`SELECT network_score FROM economic_network_intelligence WHERE profile_id=$1 ORDER BY calculated_at DESC LIMIT 1`,[profileId]);
 const a=await db.query(`SELECT score FROM graph_assessments WHERE node_type='economic_business' AND node_id=$1 ORDER BY created_at DESC LIMIT 1`,[profileId]);
 const e=await db.query(`SELECT COALESCE(AVG(trust_score),0)::numeric AS trust FROM economic_evidence_vault WHERE profile_id=$1 AND verification_status='verified'`,[profileId]);
 if(!n.rows.length||!a.rows.length)return res.status(409).json({ok:false,error:'Network intelligence and assessment are required before recalibrated consensus.'});
 const c=await db.query(`SELECT network_weight,assessment_weight,evidence_weight,calibration_state,feedback_count FROM economic_intelligence_recalibration WHERE profile_id=$1 ORDER BY created_at DESC LIMIT 1`,[profileId]);
 const weights=c.rows.length?c.rows[0]:{network_weight:40,assessment_weight:35,evidence_weight:25,calibration_state:'baseline',feedback_count:0};
 const network=Number(n.rows[0].network_score||0),assessment=Number(a.rows[0].score||0),evidence=Number(e.rows[0].trust||0);
 const nw=Number(weights.network_weight),aw=Number(weights.assessment_weight),ew=Number(weights.evidence_weight);
 const consensus=Math.round(network*nw/100+assessment*aw/100+evidence*ew/100);
 const confidence=consensus>=75?'high':consensus>=50?'moderate':'low';
 const decision=consensus>=75?'favorable':consensus>=50?'conditional':'needs_review';
 const rationale=[`Applied calibration state: ${weights.calibration_state}.`,`Weights: network ${nw}%, assessment ${aw}%, evidence ${ew}%.`,`Inputs: network ${network}, assessment ${assessment}, evidence trust ${evidence}.`];
 const actions=[];
 if(evidence<70)actions.push('Improve verified evidence quality and coverage.');
 if(network<70)actions.push('Strengthen and verify key economic relationships.');
 if(consensus<75)actions.push('Keep the decision conditional until supporting signals improve.');
 else actions.push('Proceed through governance controls with the recalibrated consensus.');
 res.status(200).json({ok:true,profile:p.rows[0],consensus:{consensusScore:consensus,confidence,decisionState:decision,rationale,recommendedActions:actions,calibration:{state:weights.calibration_state,networkWeight:nw,assessmentWeight:aw,evidenceWeight:ew,feedbackCount:Number(weights.feedback_count||0)}},historicalScoresPreserved:true,next:'decision'});
}