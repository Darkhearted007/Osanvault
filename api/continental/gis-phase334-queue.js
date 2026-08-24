import { db } from "hatchable";

export const access = "admin";
export const methods = ["GET","POST"];

export default async function(req,res){
  const version=req.query?.crosswalk_version||req.body?.crosswalk_version||"phase323-current";
  if(req.method==="GET"){
    const {rows}=await db.query(`SELECT * FROM gis_evidence_acquisition_queue WHERE crosswalk_version=$1 ORDER BY priority ASC, source_feature_id`,[version]);
    return res.json({phase:334,crosswalk_version:version,count:rows.length,rows});
  }
  const b=req.body||{};
  if(!b.source_feature_id) return res.status(400).json({error:"source_feature_id is required"});
  const missing=Array.isArray(b.missing_fields)?b.missing_fields:[];
  const {rows}=await db.query(`INSERT INTO gis_evidence_acquisition_queue (crosswalk_version,source_feature_id,priority,required_evidence,missing_fields,current_geometry_state,target_candidates_count,requested_provider,status,rationale) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT(crosswalk_version,source_feature_id) DO UPDATE SET priority=EXCLUDED.priority,required_evidence=EXCLUDED.required_evidence,missing_fields=EXCLUDED.missing_fields,current_geometry_state=EXCLUDED.current_geometry_state,target_candidates_count=EXCLUDED.target_candidates_count,requested_provider=EXCLUDED.requested_provider,status=EXCLUDED.status,rationale=EXCLUDED.rationale,updated_at=now() RETURNING *`,[version,b.source_feature_id,Number(b.priority||100),b.required_evidence||"MEASURED_SOURCE_AND_TARGET_GEOMETRY",missing,b.current_geometry_state||"MISSING_MEASURED_SPATIAL_EVIDENCE",Number(b.target_candidates_count||0),b.requested_provider||"GRID3",b.status||"OPEN",b.rationale||{}]);
  return res.status(201).json(rows[0]);
}