import { db } from 'hatchable';
export const access='member';
export const methods=['POST'];
const clean=v=>typeof v==='string'?v.trim().slice(0,80):'';
export default async function(req,res){
 const profileId=clean(req.body?.profileId);
 if(!profileId)return res.status(400).json({ok:false,error:'profileId is required.'});
 const p=await db.query(`SELECT id,display_name FROM economic_onboarding_profiles WHERE id=$1 AND owner_id=$2 AND data_environment='production' LIMIT 1`,[profileId,req.member.id]);
 if(!p.rows.length)return res.status(404).json({ok:false,error:'Production profile not found.'});
 const c=await db.query(`SELECT id,consensus_score,confidence,decision_state,drivers,source_signal_ids FROM economic_explainable_consensus WHERE profile_id=$1 ORDER BY created_at DESC LIMIT 1`,[profileId]);
 if(!c.rows.length)return res.status(409).json({ok:false,error:'Explainable consensus is required before a decision can be recommended.'});
 const x=c.rows[0], score=Number(x.consensus_score||0), state=x.decision_state;
 const risks=[]; const actions=[]; const governance=[];
 if(state==='favorable'){actions.push('Proceed to governed review.');governance.push('Independent approval required before execution.');}
 else if(state==='conditional'){risks.push('Consensus is conditional; additional evidence or review may be required.');actions.push('Request targeted evidence and conduct governance review.');governance.push('Enhanced review required before any execution.');}
 else {risks.push('Consensus is unfavorable.');actions.push('Do not proceed until material risk drivers are resolved.');governance.push('Execution remains blocked pending reassessment.');}
 const rationale=`Recommended decision is ${state} at ${score}/100 based on the explainable consensus and its verified-evidence lineage.`;
 const r=await db.query(`INSERT INTO economic_explainable_decisions(profile_id,consensus_id,decision_state,decision_score,confidence,rationale,risk_factors,recommended_actions,governance_requirements,source_signal_ids,auto_execution_allowed,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,false,$11) RETURNING id,profile_id AS "profileId",consensus_id AS "consensusId",decision_state AS "decisionState",decision_score AS "decisionScore",confidence,rationale,risk_factors AS "riskFactors",recommended_actions AS "recommendedActions",governance_requirements AS "governanceRequirements",source_signal_ids AS "sourceSignalIds",auto_execution_allowed AS "autoExecutionAllowed",created_at AS "createdAt"`,[profileId,x.id,state,score,x.confidence,rationale,JSON.stringify(risks),JSON.stringify(actions),JSON.stringify(governance),JSON.stringify(x.source_signal_ids||[]),req.member.id]);
 res.status(201).json({ok:true,profile:p.rows[0],decision:r.rows[0],publicExposure:false,next:'governed_approval'});
}