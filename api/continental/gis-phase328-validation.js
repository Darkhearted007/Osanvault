import { db } from "hatchable";

export const access = "admin";
export const methods = ["GET"];

export default async function (req, res) {
  const { rows } = await db.query(`SELECT s.provider,s.dataset_name,s.dataset_version,s.status,s.feature_count,s.imported_at,COUNT(f.id)::int AS stored_features,COUNT(f.id) FILTER (WHERE f.geometry_valid=true AND f.normalized_geometry_available=true)::int AS valid_features,COUNT(f.id) FILTER (WHERE f.geometry_geojson IS NULL OR f.geometry_valid=false)::int AS invalid_or_missing FROM gis_geometry_sources s LEFT JOIN gis_geometry_features f ON f.source_id=s.id GROUP BY s.id ORDER BY s.provider,s.dataset_name`);
  return res.json({ phase: 328, validation: rows, total_valid_features: rows.reduce((n,r)=>n+Number(r.valid_features||0),0), policy: "Only source-backed geometry is eligible for spatial identity scoring." });
}