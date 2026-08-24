import { db } from "hatchable";

export const access = "admin";
export const methods = ["POST"];

export default async function (req,res) {
  const version=req.body?.crosswalk_version||"phase323-current";
  const started=Date.now();
  const open=await db.query(`SELECT source_feature_id,target_feature_id FROM gis_current_exception_queue WHERE crosswalk_version=$1 AND status='OPEN'`,[version]);
  let resolved=0, review=0, unresolved=0, blockedGeometry=0;
  for(const x of open.rows){
    const r=await db.query(`SELECT decision,confidence,spatial_iou FROM gis_identity_resolution_results WHERE crosswalk_version=$1 AND source_feature_id=$2 AND target_feature_id=$3 ORDER BY created_at DESC LIMIT 1`,[version,x.source_feature_id,x.target_feature_id]);
    if(!r.rows.length){ unresolved++; blockedGeometry++; continue; }
    const e=r.rows[0];
    if(e.decision==='RESOLVED'){ await db.query(`UPDATE gis_current_exception_queue SET status='RESOLVED_SPATIAL', evidence=evidence || jsonb_build_object('phase333',jsonb_build_object('decision',$1,'confidence',$2,'iou',$3,'reconciled_at',now())) WHERE crosswalk_version=$4 AND source_feature_id=$5 AND target_feature_id=$6 AND status='OPEN'`,[e.decision,e.confidence,e.spatial_iou,version,x.source_feature_id,x.target_feature_id]); resolved++; }
    else if(e.decision==='REVIEW') review++; else unresolved++;
  }
  const ins=await db.query(`INSERT INTO gis_reconciliation_runs (crosswalk_version,scanned_open,resolved,review,unresolved,blocked_geometry,completed_at) VALUES ($1,$2,$3,$4,$5,$6,now()) RETURNING *`,[version,open.rows.length,resolved,review,unresolved,blockedGeometry]);
  return res.json({phase:333,crosswalk_version:version,run:ins.rows[0],duration_ms:Date.now()-started,certification:"BLOCKED",message:blockedGeometry?"Open cases remain without measured spatial resolution evidence.":"Reconciliation completed; certification gate remains evidence-controlled."});
}