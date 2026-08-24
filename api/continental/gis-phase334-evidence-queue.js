import { db } from "hatchable";

export const access = "admin";
export const methods = ["GET","POST"];

export default async function(req,res){
  const version=req.query?.crosswalk_version||req.body?.crosswalk_version||"phase323-current";
  if(req.method==="GET"){
    const {rows}=await db.query(`SELECT * FROM gis_evidence_acquisition_queue WHERE crosswalk_version=$1 ORDER BY CASE priority WHEN 'CRITICAL' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 3 ELSE 4 END,source_feature_id`,[version]);
    return res.json({crosswalk_version:version,count:rows.length,rows});
  }
  const b=req.body||{};
  if(!b.source_feature_id) return res.status(400).json({error:"source_feature_id is required"});
  const {rows}=await db.query(`INSERT INTO gis_evidence_acquisition_queue (crosswalk_version,source_feature_id,priority,missing_geometry,missing_intersection,missing_identity_evidence,required_provider,required_dataset,required_evidence,status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT(crosswalk_version,source_feature_id) DO UPDATE SET priority=EXCLUDED.priority,missing_geometry=EXCLUDED.missing_geometry,missing_intersection=EXCLUDED.missing_intersection,missing_identity_evidence=EXCLUDED.missing_identity_evidence,required_provider=EXCLUDED.required_provider,required_dataset=EXCLUDED.required_dataset,required_evidence=EXCLUDED.required_evidence,status=EXCLUDED.status,updated_at=now() RETURNING *`,[version,b.source_feature_id,b.priority||"HIGH",b.missing_geometry!==false,b.missing_intersection!==false,b.missing_identity_evidence===true,b.required_provider||"GRID3/SALB",b.required_dataset||"authoritative boundary geometry",b.required_evidence||{},b.status||"OPEN"]);
  return res.status(201).json(rows[0]);
}