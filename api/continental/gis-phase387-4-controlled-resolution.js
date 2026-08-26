import { db } from 'hatchable';
export const access='admin';
export const methods=['GET','POST'];
export default async function(req,res){
 if(req.method==='GET'){
  const q=await db.query("SELECT reviewer_decision,status,count(*)::int count FROM gis_phase3865_review_queue GROUP BY reviewer_decision,status ORDER BY status,reviewer_decision");
  return res.json({phase:'387.4',summary:q.rows,certificationRemainsBlocked:true});
 }
 const decisions=(await db.query("SELECT id,source_feature_id,target_feature_id,reviewer_decision,rationale FROM gis_phase3865_review_queue WHERE status IN ('APPROVED','REJECTED','QUARANTINED','DEFERRED') AND reviewer_decision IS NOT NULL ORDER BY reviewed_at NULLS LAST,updated_at")).rows;
 let applied=0, skipped=0;
 for(const d of decisions){
  const ev={phase3874:{reviewDecision:d.reviewer_decision,rationale:d.rationale||null,appliedAt:new Date().toISOString()}};
  if(d.reviewer_decision==='APPROVE' && d.target_feature_id){
   await db.query("UPDATE gis_final_identity_crosswalk SET status='LOCKED',target_feature_id=$1,evidence=evidence || $3::jsonb WHERE source_feature_id=$2",[d.target_feature_id,d.source_feature_id,JSON.stringify(ev)]);
   await db.query("UPDATE gis_phase3865_review_queue SET evidence=evidence || $1::jsonb,updated_at=now() WHERE id=$2",[JSON.stringify(ev),d.id]); applied++;
  } else if(['REJECT','QUARANTINE','DEFER'].includes(d.reviewer_decision)){
   await db.query("UPDATE gis_phase3865_review_queue SET evidence=evidence || $1::jsonb,updated_at=now() WHERE id=$2",[JSON.stringify(ev),d.id]); applied++;
  } else skipped++;
 }
 const open=(await db.query("SELECT count(*)::int n FROM gis_phase3865_review_queue WHERE status='OPEN'")).rows[0].n;
 const approved=(await db.query("SELECT count(*)::int n FROM gis_phase3865_review_queue WHERE status='APPROVED' AND reviewer_decision='APPROVE'")).rows[0].n;
 return res.json({phase:'387.4',decisionsFound:decisions.length,applied,skipped,openExceptions:open,reviewerApprovals:approved,certificationEligible:open===0,certificationEnabled:false});
}