import { db } from "hatchable";

export const access = "admin";
export const methods = ["GET"];

export default async function (req, res) {
  const dataset = await db.query("SELECT id FROM gis_phase372_boundary_datasets WHERE dataset_key='GRID3_ADMIN_BOUNDARIES'");
  const d = dataset.rows[0];
  if (!d) return res.status(404).json({ error: "GRID3_ADMIN_BOUNDARIES_NOT_FOUND" });

  const wardCount = await db.query("SELECT COUNT(*)::int AS n FROM gis_phase372_boundary_features WHERE dataset_id=$1 AND boundary_level='WARD'", [d.id]);
  const nullParent = await db.query("SELECT COUNT(*)::int AS n FROM gis_phase372_boundary_features WHERE dataset_id=$1 AND boundary_level='WARD' AND (parent_id IS NULL OR parent_id='')", [d.id]);
  const states = await db.query("SELECT COUNT(DISTINCT state_code)::int AS n FROM gis_phase372_boundary_features WHERE dataset_id=$1 AND boundary_level='WARD' AND state_code IS NOT NULL AND state_code<>''", [d.id]);
  const duplicate = await db.query("SELECT COUNT(*)::int AS n FROM (SELECT boundary_id FROM gis_phase372_boundary_features WHERE dataset_id=$1 AND boundary_level='WARD' GROUP BY boundary_id HAVING COUNT(*)>1) x", [d.id]);

  const ok = wardCount.rows[0].n === 5872 && nullParent.rows[0].n === 0 && duplicate.rows[0].n === 0 && states.rows[0].n > 0;
  return res.json({ phase: 385, status: ok ? "VALIDATED" : "REVIEW_REQUIRED", wardCount: wardCount.rows[0].n, missingParentCount: nullParent.rows[0].n, duplicateGroups: duplicate.rows[0].n, distinctStateCodes: states.rows[0].n, hierarchyValidated: ok });
}