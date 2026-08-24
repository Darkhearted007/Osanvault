import { db } from "hatchable";

export const access = "admin";
export const methods = ["GET"];

export default async function (req, res) {
  const sources = await db.query(`SELECT dataset_name,dataset_version,status,feature_count,imported_at,provenance->>'service_url' AS service_url FROM gis_geometry_sources WHERE provider='GRID3' ORDER BY dataset_name`);
  const features = await db.query(`SELECT COUNT(*)::int AS total,COUNT(*) FILTER(WHERE geometry_valid=true AND normalized_geometry_available=true)::int AS valid,COUNT(*) FILTER(WHERE geometry_geojson IS NULL OR geometry_valid=false OR normalized_geometry_available=false)::int AS blocked FROM gis_geometry_features WHERE provider='GRID3'`);
  const exceptions = await db.query(`SELECT COUNT(*) FILTER(WHERE status='OPEN')::int AS open_exceptions FROM gis_current_exception_queue`);
  return res.json({ phase: 328, status: 'GEOMETRY_INGESTION_COMPLETE', sources: sources.rows, geometry: features.rows[0] || {}, open_exceptions: exceptions.rows[0]?.open_exceptions ?? 0, next_gate: 'SPATIAL_IDENTITY_MATCHING' });
}