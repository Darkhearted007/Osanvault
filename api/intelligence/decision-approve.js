import { db } from 'hatchable';
export const access='member';
export const methods=['POST'];
const clean=v=>typeof v==='string'?v.trim().slice(0,120):'';
export default async function(req,res){
 const decisionId=clean(req.body?.decisionId), action=clean(req.body?.action).toLowerCase(), notes=clean(req.body?.notes);
 if(!decisionId||!['approve','reject'].includes(action))return res.status(400).json({ok:false,error:'decisionId and approve/reject action are required.'});
 const q=await db.query(`SELECT d.id,d.profile_id,d.approval_state,d.decision_state,d.decided_by,p.owner_id FROM economic_decision_actions d JOIN economic_onboarding_profiles p ON p.id=d.profile_id WHERE d.id=$1 AND p.owner_id=$2 AND p.data_environment='production' LIMIT 1`,[decisionId,req.member.id]);
 if(!q.rows.length)return res.status(404).json({ok:false,error:'Decision not found in an owned production profile.'});
 const d=q.rows[0];
 if(d.approval_state!=='pending_approval')return res.status(409).json({ok:false,error:`Decision is not awaiting approval. Current state: ${d.approval_state}.`});
 if(d.decided_by&&d.decided_by===req.member.id)return res.status(403).json({ok:false,error:'Separation of duties: the decision creator cannot approve their own decision.'});
 const next=action==='approve'?'approved':'rejected';
 const u=await db.query(`UPDATE economic_decision_actions SET approval_state=$1,approval_by=$2,approval_at=now(),approval_notes=$3 WHERE id=$4 RETURNING id,decision_state AS "decisionState",approval_state AS "approvalState",approval_by AS "approvalBy",approval_at AS "approvalAt",approval_notes AS "approvalNotes"`,[next,req.member.id,notes,decisionId]);
 await db.query(`INSERT INTO economic_decision_governance_events(decision_action_id,profile_id,event_type,from_state,to_state,actor_id,notes) VALUES($1,$2,$3,$4,$5,$6,$7)`,[decisionId,d.profile_id,action==='approve'?'approved':'rejected',d.approval_state,next,req.member.id,notes]);
 res.json({ok:true,decision:u.rows[0],governance:'separation_of_duties_enforced',next:next==='approved'?'execution':'review'});
}