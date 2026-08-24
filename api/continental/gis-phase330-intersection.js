import { db } from "hatchable";

export const access = "admin";
export const methods = ["GET", "POST"];

export default async function (req, res) {
  const version = req.query?.crosswalk_version || req.body?.crosswalk_version || "phase323-current";

  if (req.method === "GET") {
    const { rows } = await db.query(`SELECT crosswalk_version, source_feature_id, target_feature_id, source_provider, target_provider, source_geometry_available, target_geometry_available, intersection_area, source_area, target_area, source_overlap_ratio, target_overlap_ratio, iou, geometry_method, geometry_crs, evidence_status, confidence, evidence, created_at FROM gis_spatial_intersection_evidence WHERE crosswalk_version=$1 ORDER BY source_feature_id,target_feature_id`, [version]);
    return res.json({crosswalk_version:version, rows});
  }

  const b=req.body||{};
  if(!b.source_feature_id||!b.target_feature_id||!b.source_provider||!b.target_provider) return res.status(400).json({error:"source_feature_id, target_feature_id, source_provider and target_provider are required"});
  const geometryReady=b.source_geometry_available===true&&b.target_geometry_available===true&&Number.isFinite(Number(b.intersection_area));
  const status=geometryReady?"MEASURED":"REQUIRES_GEOMETRY";
  const confidence=geometryReady&&Number(b.iou)>=0.5?"HIGH":geometryReady&&Number(b.iou)>=0.2?"MEDIUM":"UNRESOLVED";
  const {rows}=await db.query(`INSERT INTO gis_spatial_intersection_evidence (crosswalk_version,source_feature_id,target_feature_id,source_provider,target_provider,source_geometry_available,target_geometry_available,intersection_area,source_area,target_area,source_overlap_ratio,target_overlap_ratio,iou,geometry_method,geometry_crs,evidence_status,confidence,evidence) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) ON CONFLICT(crosswalk_version,source_feature_id,target_feature_id) DO UPDATE SET intersection_area=EXCLUDED.intersection_area,source_area=EXCLUDED.source_area,target_area=EXCLUDED.target_area,source_overlap_ratio=EXCLUDED.source_overlap_ratio,target_overlap_ratio=EXCLUDED.target_overlap_ratio,iou=EXCLUDED.iou,geometry_method=EXCLUDED.geometry_method,geometry_crs=EXCLUDED.geometry_crs,evidence_status=EXCLUDED.evidence_status,confidence=EXCLUDED.confidence,evidence=EXCLUDED.evidence,created_at=now() RETURNING *`,[version,b.source_feature_id,b.target_feature_id,b.source_provider,b.target_provider,b.source_geometry_available===true,b.target_geometry_available===true,b.intersection_area??null,b.source_area??null,b.target_area??null,b.source_overlap_ratio??null,b.target_overlap_ratio??null,b.iou??null,b.geometry_method??null,b.geometry_crs??null,status,confidence,b.evidence??{}]);
  return res.status(201).json(rows[0]);
}