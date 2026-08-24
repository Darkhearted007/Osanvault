import { db } from "hatchable";

export const access = "admin";
export const methods = ["POST"];

export default async function(req,res){
  const version=req.body?.crosswalk_version||"phase323-current";
  const {rows:open}=await db.query(`SELECT source_feature_id FROM gis_current_exception_queue WHERE crosswalk_version=$1 AND status='OPEN' ORDER BY source_feature_id`,[version]);
  let created=0;
  for(const item of open){
    const candidates=await db.query(`SELECT COUNT(*)::int AS n FROM gis_spatial_identity_evidence WHERE crosswalk_version=$1 AND source_feature_id=$2`,[version,item.source_feature_id]);
    const measured=await db.query(`SELECT COUNT(*)::int AS n FROM gis_spatial_intersection_evidence WHERE crosswalk_version=$1 AND source_feature_id=$2 AND evidence_status='MEASURED'`,[version,item.source_feature_id]);
    const missing=measured.rows[0].n>0?[]:["measured_intersection_area","iou","source_overlap_ratio","target_overlap_ratio"];
    const priority=measured.rows[0].n===0?10:50;
    await db.query(`INSERT INTO gis_evidence_acquisition_queue (crosswalk_version,source_feature_id,priority,required_evidence,missing_fields,current_geometry_state,target_candidates_count,requested_provider,status,rationale) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'OPEN',$9) ON CONFLICT(crosswalk_version,source_feature_id) DO UPDATE SET priority=EXCLUDED.priority,missing_fields=EXCLUDED.missing_fields,current_geometry_state=EXCLUDED.current_geometry_state,target_candidates_count=EXCLUDED.target_candidates_count,rationale=EXCLUDED.rationale,updated_at=now()`,[version,item.source_feature_id,priority,"MEASURED_POLYGON_INTERSECTION_EVIDENCE",missing,measured.rows[0].n>0?"MEASURED_EVIDENCE_EXISTS":"GEOMETRY_PRESENT_BUT_MEASURED_EVIDENCE_MISSING",candidates.rows[0].n,"GRID3",{candidates:candidates.rows[0].n,measured_intersections:measured.rows[0].n}]);
    created++;
  }
  return res.json({phase:334,crosswalk_version:version,scanned:open.length,queued:created,policy:"NO_CERTIFICATION_WITHOUT_MEASURED_GEOMETRY_EVIDENCE"});
}