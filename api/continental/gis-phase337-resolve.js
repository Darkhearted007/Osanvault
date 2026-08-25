import { db } from "hatchable";
export const access="admin";
export const methods=["POST"];
export default async function(req,res){
 const version=req.body?.crosswalk_version||"phase323-current";
 const min=req.body?.limit?Math.min(Number(req.body.limit),1000):1000;
 const q=await db.query(`SELECT source_feature_id,target_feature_id,spatial_iou,source_overlap_ratio,target_overlap_ratio,identity_score,combined_score FROM gis_identity_resolution_results WHERE crosswalk_version=$1 ORDER BY source_feature_id,combined_score DESC NULLS LAST LIMIT $2`,[version,min]);
 let high=0,review=0,unresolved=0;
 for(const r of q.rows){
  const i=Number(r.spatial_iou), id=Number(r.identity_score), c=Number(r.combined_score);
  let decision="UNRESOLVED", confidence="LOW";
  if(Number.isFinite(i)&&Number.isFinite(id)&&Number.isFinite(c)){if(i>=0.8&&id>=0.75&&c>=0.82){decision="RESOLVED";confidence="HIGH";high++;}else if(i>=0.6&&id>=0.65&&c>=0.72){decision="REVIEW";confidence="MEDIUM";review++;}else unresolved++;}else unresolved++;
  await db.query(`UPDATE gis_identity_resolution_results SET decision=$1,confidence=$2,rationale=$3,created_at=now() WHERE crosswalk_version=$4 AND source_feature_id=$5 AND target_feature_id=$6`,[decision,confidence,JSON.stringify({policy:"Phase 337",spatial_iou:r.spatial_iou,identity_score:r.identity_score,combined_score:r.combined_score}),version,r.source_feature_id,r.target_feature_id]);
 }
 const activation=high>0&&review===0&&unresolved===0;
 const run=await db.query(`INSERT INTO gis_ambiguity_resolution_runs (crosswalk_version,candidate_count,high_confidence_count,review_count,unresolved_count,activation_eligible) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,[version,q.rows.length,high,review,unresolved,activation]);
 return res.json({phase:337,runId:run.rows[0].id,candidateCount:q.rows.length,highConfidence:high,reviewRequired:review,unresolved,activationEligible:activation});
}