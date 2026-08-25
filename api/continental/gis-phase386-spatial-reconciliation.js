import { db } from "hatchable";

export const access = "public";
export const methods = ["GET"];

export default async function (req, res) {
  const h = await db.query("SELECT * FROM gis_phase385_hierarchy_reconciliation LIMIT 1");
  if (!h.rows.length) return res.status(404).json({ phase: 386, status: "REVIEW_REQUIRED", error: "PHASE_385_RECONCILIATION_EVIDENCE_NOT_FOUND" });
  const x = h.rows[0];
  const result = {
    phase: 386,
    status: x.spatial_validation_status || "REVIEW_REQUIRED",
    wards: Number(x.ward_count || 0),
    spatiallyValidated: x.spatial_validation_status === "VALIDATED",
    geometryPresent: Number(x.geometry_present_count || 0),
    geometryEmpty: Number(x.geometry_empty_count || 0),
    geometryInvalid: Number(x.geometry_invalid_count || 0),
    parentSpatialChecks: Number(x.parent_spatial_checks || 0),
    parentSpatialFailures: Number(x.parent_spatial_failures || 0),
    note: "Spatial validation is evidence-driven; no certification is enabled by this endpoint."
  };
  return res.json(result);
}