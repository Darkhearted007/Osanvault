import { db } from "hatchable";

export const access = "admin";
export const methods = ["GET"];

export default async function (req,res) {
  const version=req.query?.crosswalk_version||"phase323-current";
  const {rows}=await db.query(`SELECT decision,confidence,COUNT(*)::int AS count FROM gis_identity_resolution_results WHERE crosswalk_version=$1 GROUP BY decision,confidence ORDER BY decision,confidence`,[version]);
  const totals=await db.query(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER(WHERE decision='RESOLVED')::int AS resolved, COUNT(*) FILTER(WHERE decision='REVIEW')::int AS review, COUNT(*) FILTER(WHERE decision='UNRESOLVED')::int AS unresolved FROM gis_identity_resolution_results WHERE crosswalk_version=$1`,[version]);
  return res.json({crosswalk_version:version,summary:totals.rows[0]||{},breakdown:rows,certification_policy:"Only RESOLVED records meeting explicit spatial and identity thresholds may be certified."});
}