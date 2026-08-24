import { db } from "hatchable";
export const access="admin";
export const methods=["POST"];
export default async function(req,res){
 const version=req.body?.crosswalk_version||"phase323-current";
 const {rows:open}=await db.query(`SELECT source_feature_id FROM gis_current_exception_queue WHERE crosswalk_version=$1 AND status='OPEN' ORDER BY source_feature_id`,[version]);
 let created=0;
 for(const item of open){
  const candidates=await db.query(`SELECT COUNT(*)::int AS n FROM gis_spatial_identity_evidence WHERE crosswalk_version=$1 AND source_feature_id=$2`,[version,item.source_feature_id]);
  const measured=await db.query(`SELECT COUNT(*)::int AS n FROM gis_spatial_intersection_evidence WHERE crosswalk_version=$1 AND source_feature_id=$2 AND evidence_status='MEASURED'`,[version,item.source_feature_id]);
  const missing=measured.rows[0].n>0?[]:["measured_intersection_area","iou","source_overlap_ratio","target_overlap_ratio"];
  await db.query(`INSERT INTO gis_evidence_acquisition_queue (crosswalk_version,source_feature_id,priority,missing_evidence,required_source_providers,status,resolution_blocker) VALUES ($1,$2,$3,$4,$5,'OPEN',$6) ON CONFLICT(crosswalk_version,source_feature_id) DO UPDATE SET priority=EXCLUDED.priority,missing_evidence=EXCLUDED.missing_evidence,required_source_providers=EXCLUDED.required_source_providers,status=EXCLUDED.status,resolution_blocker=EXCLUDED.resolution_blocker,updated_at=now()`,[version,item.source_feature_id,measured.rows[0].n===0?10:50,JSON.stringify(missing),JSON.stringify(["GRID3"]),"MEASURED_POLYGON_INTERSECTION_EVIDENCE_REQUIRED"]);
  created++;
 }
 return res.json({phase:334,crosswalk_version:version,scanned:open.length,queued:created,policy:"NO_CERTIFICATION_WITHOUT_MEASURED_GEOMETRY_EVIDENCE"});
}