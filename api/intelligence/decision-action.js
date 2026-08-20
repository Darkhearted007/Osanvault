import { db } from 'hatchable';
export const access='member';
export const methods=['POST'];
const clean=v=>typeof v==='string'?v.trim().slice(0,80):'';
export default async function(req,res){
 const profileId=clean(req.body?.profileId);
 if(!profileId)return res.status(400).json({ok:false,error:'profileId is required.'});
 const p=await db.query(`SELECT id,display_name FROM economic_onboarding_profiles WHERE id=$1 AND owner_id=$2 AND data_environment='production' LIMIT 1`,[profileId,req.member.id]);
 if(!p.rows.length)return res.status(404).json({ok:false,error:'Production profile not found.'});
 const c=await db.query(`SELECT id,consensus_score,confidence,decision_state,rationale,recommended_actions FROM economic_decision_consensus WHERE profile_id=$1 ORDER BY created_at DESC LIMIT 1`,[profileId]);
 if(!c.rows.length)return res.status(409).json({ok:false,error:'Consensus is required before creating a decision.'});
 const x=c.rows[0];
 const approval=x.decision_state==='favorable'?'pending_approval':'review_required';
 const r=await db.query(`INSERT INTO economic_decision_actions(profile_id,consensus_id,decision_state,approval_state,rationale,recommended_actions) VALUES($1,$2,$3,$4,$5,$6) RETURNING id,decision_state AS "decisionState",approval_state AS "approvalState",rationale,recommended_actions AS "recommendedActions",created_at AS "createdAt"`,[profileId,x.id,x.decision_state,approval,x.rationale,x.recommended_actions]);
 res.status(201).json({ok:true,profile:p.rows[0],decision:r.rows[0],consensus:{score:Number(x.consensus_score),confidence:x.confidence},next:approval==='pending_approval'?'approval':'review'});
}