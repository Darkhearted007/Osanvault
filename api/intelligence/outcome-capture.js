import { db } from 'hatchable';
export const access='member';
export const methods=['POST'];
const clean=(v,max)=>typeof v==='string'?v.trim().slice(0,max):'';
export default async function(req,res){
 const executionId=clean(req.body?.executionId,80), status=clean(req.body?.outcomeStatus,40).toLowerCase(), notes=clean(req.body?.completionNotes,1500);
 const rating=Number(req.body?.outcomeRating);
 if(!executionId||!['successful','partial','unsuccessful'].includes(status))return res.status(400).json({ok:false,error:'executionId and outcomeStatus successful/partial/unsuccessful are required.'});
 if(!Number.isFinite(rating)||rating<0||rating>100)return res.status(400).json({ok:false,error:'outcomeRating must be between 0 and 100.'});
 const q=await db.query(`SELECT e.id,e.profile_id,e.execution_status,p.owner_id FROM economic_decision_execution e JOIN economic_onboarding_profiles p ON p.id=e.profile_id WHERE e.id=$1 AND p.owner_id=$2 AND p.data_environment='production' LIMIT 1`,[executionId,req.member.id]);
 if(!q.rows.length)return res.status(404).json({ok:false,error:'Execution not found in an owned production profile.'});
 const e=q.rows[0];
 if(e.execution_status!=='completed')return res.status(409).json({ok:false,error:'Execution must be completed before outcome capture.'});
 const feedback=Math.round(rating);
 const lessons=[];
 if(status==='successful')lessons.push('Decision execution produced the intended outcome.');
 if(status==='partial')lessons.push('Decision produced a mixed outcome; review assumptions and execution conditions.');
 if(status==='unsuccessful')lessons.push('Decision outcome was below expectations; review evidence, network signals, and assumptions.');
 const u=await db.query(`UPDATE economic_decision_execution SET outcome_status=$1,outcome_rating=$2,completion_notes=$3,updated_at=now() WHERE id=$4 RETURNING id,execution_status AS "executionStatus",outcome_status AS "outcomeStatus",outcome_rating AS "outcomeRating",completion_notes AS "completionNotes"`,[status,rating,notes,executionId]);
 const f=await db.query(`INSERT INTO economic_intelligence_feedback(execution_id,profile_id,outcome_rating,outcome_status,feedback_signal,lessons,created_by) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id,outcome_rating AS "outcomeRating",outcome_status AS "outcomeStatus",feedback_signal AS "feedbackSignal",lessons,created_at AS "createdAt"`,[executionId,e.profile_id,rating,status,feedback,JSON.stringify(lessons),req.member.id]);
 res.json({ok:true,execution:u.rows[0],feedback:f.rows[0],next:'intelligence_recalibration'});
}