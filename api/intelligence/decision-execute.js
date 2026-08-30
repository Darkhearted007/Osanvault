import { db } from 'hatchable';
export const access='admin';
export const methods=['POST'];
const clean=v=>typeof v==='string'?v.trim().slice(0,120):'';
export default async function(req,res){
 const decisionId=clean(req.body?.decisionId), targetDate=clean(req.body?.targetDate);
 if(!decisionId)return res.status(400).json({ok:false,error:'decisionId is required.'});
 const q=await db.query(`SELECT d.id,d.profile_id,d.approval_state,p.owner_id FROM economic_decision_actions d JOIN economic_onboarding_profiles p ON p.id=d.profile_id WHERE d.id=$1 AND p.owner_id=$2 AND p.data_environment='production' LIMIT 1`,[decisionId,req.member.id]);
 if(!q.rows.length)return res.status(404).json({ok:false,error:'Decision not found in an owned production profile.'});
 const d=q.rows[0];
 if(d.approval_state!=='approved')return res.status(409).json({ok:false,error:'Only approved decisions can enter execution.'});
 const existing=await db.query(`SELECT id FROM economic_decision_execution WHERE decision_action_id=$1 LIMIT 1`,[decisionId]);
 if(existing.rows.length)return res.status(409).json({ok:false,error:'Execution already exists for this decision.',executionId:existing.rows[0].id});
 const r=await db.query(`INSERT INTO economic_decision_execution(decision_action_id,profile_id,execution_status,owner_id,target_date) VALUES($1,$2,'not_started',$3,$4) RETURNING id,execution_status AS "executionStatus",target_date AS "targetDate",created_at AS "createdAt"`,[decisionId,d.profile_id,req.member.id,targetDate||null]);
 await db.query(`INSERT INTO economic_decision_outcome_events(execution_id,profile_id,event_type,from_status,to_status,actor_id,notes) VALUES($1,$2,'execution_created',NULL,'not_started',$3,$4)`,[r.rows[0].id,d.profile_id,req.member.id,'Approved decision entered execution.']);
 res.status(201).json({ok:true,execution:r.rows[0],next:'outcome_tracking'});
}