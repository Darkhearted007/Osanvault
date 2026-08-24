import { db } from "hatchable";

export const access = "admin";
export const methods = ["POST"];

export default async function(req,res){
  const version=req.body?.crosswalk_version||"phase323-current";
  const {rows}=await db.query(`SELECT source_feature_id FROM gis_current_exception_queue WHERE crosswalk_version=$1 AND status='OPEN' ORDER BY source_feature_id`,[version]);
  let created=0;
  for(const r of rows){
    const x=await db.query(`INSERT INTO gis_evidence_acquisition_queue (crosswalk_version,source_feature_id,priority,missing_evidence,required_source_providers,status,resolution_blocker) VALUES ($1,$2,'HIGH','{"needed":["source_geometry","target_geometry","polygon_intersection","iou"]}'::jsonb,'{"providers":["GRID3","SALB"]}'::jsonb,'OPEN','Measured spatial evidence required before certification') ON CONFLICT(crosswalk_version,source_feature_id) DO UPDATE SET updated_at=now() RETURNING id`,[version,r.source_feature_id]);
    if(x.rowCount) created++;
  }
  return res.json({phase:334,crosswalk_version:version,open_cases:rows.length,queue_upserts:created,status:"EVIDENCE_ACQUISITION_REQUIRED"});
}