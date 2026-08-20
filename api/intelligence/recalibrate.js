import { db } from 'hatchable';
export const access='member';
export const methods=['POST'];
const clean=v=>typeof v==='string'?v.trim().slice(0,80):'';
export default async function(req,res){
 const profileId=clean(req.body?.profileId);
 if(!profileId)return res.status(400).json({ok:false,error:'profileId is required.'});
 const p=await db.query(`SELECT id,display_name FROM economic_onboarding_profiles WHERE id=$1 AND owner_id=$2 AND data_environment='production' LIMIT 1`,[profileId,req.member.id]);
 if(!p.rows.length)return res.status(404).json({ok:false,error:'Production profile not found.'});
 const f=await db.query(`SELECT COUNT(*)::int AS count,COALESCE(AVG(outcome_rating),0)::numeric AS average FROM economic_intelligence_feedback WHERE profile_id=$1`,[profileId]);
 const count=Number(f.rows[0].count||0),average=Number(f.rows[0].average||0);
 let network=40,assessment=35,evidence=25,state='baseline';
 const notes=[];
 if(count>=3){
   if(average<40){network=35;assessment=30;evidence=35;state='evidence_weighted';notes.push('Repeated weak outcomes increase emphasis on evidence quality.');}
   else if(average>=80){network=45;assessment=35;evidence=20;state='network_weighted';notes.push('Repeated strong outcomes support greater reliance on validated network signals.');}
   else {network=40;assessment=35;evidence=25;state='stable';notes.push('Outcome feedback is consistent; baseline weights retained.');}
 } else notes.push('Fewer than three outcomes: baseline weights retained to avoid overfitting.');
 const r=await db.query(`INSERT INTO economic_intelligence_recalibration(profile_id,feedback_count,average_feedback,network_weight,assessment_weight,evidence_weight,calibration_state,adjustment_notes,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id,feedback_count AS "feedbackCount",average_feedback AS "averageFeedback",network_weight AS "networkWeight",assessment_weight AS "assessmentWeight",evidence_weight AS "evidenceWeight",calibration_state AS "calibrationState",adjustment_notes AS "adjustmentNotes",created_at AS "createdAt"`,[profileId,count,average,network,assessment,evidence,state,JSON.stringify(notes),req.member.id]);
 res.status(201).json({ok:true,profile:p.rows[0],recalibration:r.rows[0],historicalScoresPreserved:true,next:'consensus_recalibration'});
}