import { db } from "hatchable";

export const access = "admin";
export const methods = ["POST"];

export default async function(req,res){
  const version=req.body?.crosswalk_version||"phase323-current";
  const {rows}=await db.query(`SELECT source_feature_id FROM gis_current_exception_queue WHERE crosswalk_version=$1 AND status='OPEN' ORDER BY source_feature_id`,[version]);
  let created=0;
  for(const r of rows){
    const evidence=await db.query(`SELECT COUNT(*) FILTER(WHERE source_geometry_available=true)::int AS source_ok, COUNT(*) FILTER(WHERE target_geometry_available=true)::int AS target_ok, COUNT(*) FILTER(WHERE evidence_status='MEASURED')::int AS measured FROM gis_spatial_intersection_evidence WHERE crosswalk_version=$1 AND source_feature_id=$2`,[version,r.source_feature_id]);
    const x=evidence.rows[0]||{};
    const missing=[];
    if(!Number(x.source_ok)) missing.push('source_geometry');
    if(!Number(x.target_ok)) missing.push('target_geometry');
    if(!Number(x.measured)) missing.push('measured_intersection_iou');
    const providers=['GRID3','SALB'];
    await db.query(`INSERT INTO gis_evidence_acquisition_queue (crosswalk_version,source_feature_id,priority,missing_evidence,required_source_providers,status,resolution_blocker) VALUES ($1,$2,$3,$4,$5,'OPEN',$6) ON CONFLICT(crosswalk_version,source_feature_id) DO UPDATE SET missing_evidence=EXCLUDED.missing_evidence,required_source_providers=EXCLUDED.required_source_providers,status=CASE WHEN EXCLUDED.missing_evidence='[]'::jsonb THEN 'READY_FOR_RESOLUTION' ELSE 'OPEN' END,resolution_blocker=EXCLUDED.resolution_blocker,updated_at=now()`,[version,r.source_feature_id,missing.includes('measured_intersection_iou')?'CRITICAL':'HIGH',JSON.stringify(missing),JSON.stringify(providers),missing.length?'Missing: '+missing.join(', '):'All required evidence present']);
    created++;
  }
  return res.json({phase:334,crosswalk_version:version,scanned:rows.length,queued:created,message:'Evidence acquisition queue rebuilt from current open exceptions; no identity was resolved by this operation.'});
}