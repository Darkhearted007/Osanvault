import { db } from "hatchable";

export const access = "admin";
export const methods = ["GET", "POST"];

export default async function(req,res){
  const version=req.query?.crosswalk_version||req.body?.crosswalk_version||"phase323-current";
  if(req.method==='GET'){
    const {rows}=await db.query(`SELECT * FROM gis_evidence_acquisition_queue WHERE crosswalk_version=$1 ORDER BY CASE priority WHEN 'CRITICAL' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 3 ELSE 4 END, source_feature_id`,[version]);
    return res.json({crosswalk_version:version,rows});
  }
  const b=req.body||{};
  if(!b.source_feature_id) return res.status(400).json({error:'source_feature_id is required'});
  const missing=Array.isArray(b.missing_evidence)?b.missing_evidence:[];
  const providers=Array.isArray(b.required_source_providers)?b.required_source_providers:[];
  const {rows}=await db.query(`INSERT INTO gis_evidence_acquisition_queue (crosswalk_version,source_feature_id,priority,missing_evidence,required_source_providers,status,resolution_blocker) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(crosswalk_version,source_feature_id) DO UPDATE SET priority=EXCLUDED.priority,missing_evidence=EXCLUDED.missing_evidence,required_source_providers=EXCLUDED.required_source_providers,status=EXCLUDED.status,resolution_blocker=EXCLUDED.resolution_blocker,updated_at=now() RETURNING *`,[version,b.source_feature_id,b.priority||'HIGH',missing,providers,b.status||'OPEN',b.resolution_blocker||'Measured spatial evidence is required before certification']);
  return res.status(201).json(rows[0]);
}