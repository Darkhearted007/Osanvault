import { db } from "hatchable";

export const access = "admin";
export const methods = ["GET"];

export default async function (req, res) {
  const version = req.query?.crosswalk_version || "phase323-current";
  const { rows } = await db.query(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'OPEN')::int AS open_exceptions,
       COUNT(*) FILTER (WHERE decision = 'CONFLICT')::int AS conflicts,
       COUNT(*) FILTER (WHERE decision = 'GEOMETRY_DATA_REQUIRED')::int AS geometry_required,
       COUNT(*) FILTER (WHERE decision IN ('LOW_CONFIDENCE','UNRESOLVED'))::int AS unresolved_evidence
     FROM gis_current_exception_queue q
     LEFT JOIN gis_spatial_identity_evidence e
       ON e.crosswalk_version = $1 AND e.source_feature_id::text = q.source_feature_id::text
    WHERE q.crosswalk_version = $1`,
    [version]
  );

  const s = rows[0] || {};
  const blocked = Number(s.open_exceptions || 0) > 0 || Number(s.conflicts || 0) > 0 ||
    Number(s.geometry_required || 0) > 0 || Number(s.unresolved_evidence || 0) > 0;

  return res.json({
    crosswalk_version: version,
    certification: blocked ? "BLOCKED" : "CERTIFIABLE",
    reason: blocked ? "Current exceptions or required spatial evidence remain unresolved." : "All current identity evidence requirements pass.",
    metrics: s
  });
}