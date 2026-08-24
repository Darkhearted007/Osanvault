import { db } from "hatchable";

export const access = "admin";
export const methods = ["GET", "POST"];

export default async function (req, res) {
  if (req.method === "GET") {
    const { rows } = await db.query(`SELECT id, provider, dataset_name, dataset_version, source_url, geometry_format, geometry_crs, feature_count, provenance, status, imported_at, created_at FROM gis_geometry_sources ORDER BY provider, dataset_name, dataset_version`);
    return res.json({ rows });
  }
  const b = req.body || {};
  if (!b.provider || !b.dataset_name) return res.status(400).json({ error: "provider and dataset_name are required" });
  const { rows } = await db.query(`INSERT INTO gis_geometry_sources (provider,dataset_name,dataset_version,source_url,geometry_format,geometry_crs,feature_count,provenance,status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (provider,dataset_name,dataset_version) DO UPDATE SET source_url=EXCLUDED.source_url, geometry_format=EXCLUDED.geometry_format, geometry_crs=EXCLUDED.geometry_crs, feature_count=EXCLUDED.feature_count, provenance=EXCLUDED.provenance, status=EXCLUDED.status RETURNING *`, [b.provider,b.dataset_name,b.dataset_version ?? null,b.source_url ?? null,b.geometry_format ?? null,b.geometry_crs ?? null,b.feature_count ?? null,b.provenance ?? {},b.status ?? "REGISTERED"]);
  return res.status(201).json(rows[0]);
}