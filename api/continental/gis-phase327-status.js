import { db } from "hatchable";

export const access = "admin";
export const methods = ["GET"];

export default async function (req, res) {
  const sources = await db.query(`SELECT provider, COUNT(*)::int AS datasets, COUNT(*) FILTER (WHERE status='IMPORTED')::int AS imported_datasets FROM gis_geometry_sources GROUP BY provider ORDER BY provider`);
  const features = await db.query(`SELECT provider, COUNT(*)::int AS features, COUNT(*) FILTER (WHERE normalized_geometry_available=true)::int AS normalized_features, COUNT(*) FILTER (WHERE geometry_valid=false)::int AS invalid_features FROM gis_geometry_features GROUP BY provider ORDER BY provider`);
  const geometry = await db.query(`SELECT COUNT(*)::int AS evidence_rows, COUNT(*) FILTER (WHERE source_geometry_valid=true AND target_geometry_valid=true)::int AS rows_with_valid_geometry FROM gis_spatial_identity_evidence WHERE crosswalk_version='phase323-current'`);
  return res.json({ phase: 327, sources: sources.rows, features: features.rows, spatial_evidence: geometry.rows[0] || {}, certification_policy: "BLOCKED_WHEN_REQUIRED_GEOMETRY_IS_MISSING" });
}