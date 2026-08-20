import { db } from 'hatchable';
export const access='member';
export const methods=['GET'];
export default async function(req,res){
 const owner=req.member.id;
 const p=await db.query(`SELECT id,display_name FROM economic_onboarding_profiles WHERE owner_id=$1 AND data_environment='production' ORDER BY created_at DESC NULLS LAST,id DESC`,[owner]);
 const profiles=p.rows;
 const rows=[];
 for(const profile of profiles){
  const f=await db.query(`SELECT COUNT(*)::int AS count,COALESCE(AVG(outcome_rating),0)::numeric AS average,COUNT(*) FILTER(WHERE outcome_status='successful')::int AS successful,COUNT(*) FILTER(WHERE outcome_status='partial')::int AS partial,COUNT(*) FILTER(WHERE outcome_status='unsuccessful')::int AS unsuccessful FROM economic_intelligence_feedback WHERE profile_id=$1`,[profile.id]);
  const r=await db.query(`SELECT network_weight,assessment_weight,evidence_weight,calibration_state,created_at FROM economic_intelligence_recalibration WHERE profile_id=$1 ORDER BY created_at DESC LIMIT 1`,[profile.id]);
  const x=f.rows[0],cal=r.rows[0]||null;
  rows.push({id:profile.id,name:profile.display_name,feedbackCount:x.count,averageOutcome:Number(x.average),successful:x.successful,partial:x.partial,unsuccessful:x.unsuccessful,calibration:cal?{networkWeight:Number(cal.network_weight),assessmentWeight:Number(cal.assessment_weight),evidenceWeight:Number(cal.evidence_weight),state:cal.calibration_state,updatedAt:cal.created_at}:{networkWeight:40,assessmentWeight:35,evidenceWeight:25,state:'baseline',updatedAt:null}});
 }
 const totalFeedback=rows.reduce((s,x)=>s+x.feedbackCount,0);
 const avg=totalFeedback?rows.reduce((s,x)=>s+x.averageOutcome*x.feedbackCount,0)/totalFeedback:0;
 res.json({ok:true,source:'live_database',summary:{profiles:rows.length,feedbackCount:totalFeedback,averageOutcome:Math.round(avg*100)/100},profiles:rows});
}