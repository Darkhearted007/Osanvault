import { db } from 'hatchable';
export const access='admin';
export const methods=['POST','GET'];
export default async function(req,res){
 if(req.method==='GET'){
  const q=await db.query("SELECT classification,auto_resolution,status,COUNT(*)::int n FROM gis_phase3865_review_queue GROUP BY classification,auto_resolution,status ORDER BY classification,status");
  return res.json({phase:'386.7',summary:q.rows,certificationRemainsBlocked:true});
 }
 const q=await db.query("SELECT id,issue_type,evidence FROM gis_phase3865_review_queue WHERE status='OPEN' ORDER BY created_at");
 let counts={AUTO_APPROVE:0,AUTO_REJECT:0,ALIAS_CANDIDATE:0,GEOMETRY_DISCREPANCY:0,MANUAL_REVIEW:0};
 for(const r of q.rows){
  const e=r.evidence||{}; let cls='MANUAL_REVIEW',auto='NONE',conf=0,reason='Insufficient evidence for automatic resolution.';
  const ov=Number(e.overlap_score??-1), cs=Number(e.centroid_distance_score??-1), score=Number(e.score??-1);
  if(r.issue_type==='SPATIAL_GEOMETRY_EXCEPTION' && ov>=0.70 && cs>=0.70){cls='AUTO_APPROVE';auto='APPROVE';conf=Math.min(0.99,(ov+cs)/2);reason='Geometry evidence meets independent spatial thresholds.';}
  else if(r.issue_type==='SPATIAL_GEOMETRY_EXCEPTION' && (ov<0.20 || cs<0.20)){cls='GEOMETRY_DISCREPANCY';auto='NONE';conf=Math.max(0,Math.min(0.95,1-Math.max(ov,cs)));reason='Geometry evidence materially disagrees; requires source reconciliation.';}
  else if(r.issue_type==='IDENTITY_UNRESOLVED' && score>=0.995){cls='AUTO_APPROVE';auto='APPROVE';conf=score;reason='Near-exact identity score meets automatic threshold.';}
  else if(r.issue_type==='IDENTITY_UNRESOLVED' && score>=0.98){cls='ALIAS_CANDIDATE';auto='NONE';conf=score;reason='Strong identity score but unresolved final crosswalk; review alias/administrative naming evidence.';}
  counts[cls]++;
  await db.query("UPDATE gis_phase3865_review_queue SET classification=$1,auto_resolution=$2,confidence=$3,triage_reason=$4,updated_at=now() WHERE id=$5",[cls,auto,conf,reason,r.id]);
 }
 return res.json({phase:'386.7',processed:q.rows.length,counts,autoApproved:counts.AUTO_APPROVE,autoRejected:counts.AUTO_REJECT,manualReview:counts.MANUAL_REVIEW+counts.ALIAS_CANDIDATE+counts.GEOMETRY_DISCREPANCY,certificationRemainsBlocked:true});
}