import { db } from "hatchable";

export const access = "admin";
export const methods = ["GET", "POST"];

function decision(iou, identity, combined) {
  if (iou == null || identity == null || combined == null) return ["UNRESOLVED", "UNRESOLVED"];
  if (iou >= 0.80 && identity >= 0.75 && combined >= 0.82) return ["RESOLVED", "HIGH"];
  if (iou >= 0.60 && identity >= 0.65 && combined >= 0.72) return ["REVIEW", "MEDIUM"];
  return ["UNRESOLVED", "LOW"];
}

export default async function (req, res) {
  const version = req.query?.crosswalk_version || req.body?.crosswalk_version || "phase323-current";
  if (req.method === "GET") {
    const { rows } = await db.query(`SELECT * FROM gis_identity_resolution_results WHERE crosswalk_version=$1 ORDER BY source_feature_id,combined_score DESC NULLS LAST`, [version]);
    return res.json({ crosswalk_version: version, rows });
  }

  const b=req.body||{};
  if(!b.source_feature_id||!b.target_feature_id) return res.status(400).json({error:"source_feature_id and target_feature_id are required"});
  const iou=b.spatial_iou==null?null:Number(b.spatial_iou);
  const identity=b.identity_score==null?null:Number(b.identity_score);
  const combined=b.combined_score==null?null:Number(b.combined_score);
  const [d,c]=decision(iou,identity,combined);
  const rationale={spatial_iou:iou,identity_score:identity,combined_score:combined,policy:"Phase 332 evidence thresholds"};
  const {rows}=await db.query(`INSERT INTO gis_identity_resolution_results (crosswalk_version,source_feature_id,target_feature_id,spatial_iou,source_overlap_ratio,target_overlap_ratio,identity_score,combined_score,confidence,decision,rationale) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT(crosswalk_version,source_feature_id,target_feature_id) DO UPDATE SET spatial_iou=EXCLUDED.spatial_iou,source_overlap_ratio=EXCLUDED.source_overlap_ratio,target_overlap_ratio=EXCLUDED.target_overlap_ratio,identity_score=EXCLUDED.identity_score,combined_score=EXCLUDED.combined_score,confidence=EXCLUDED.confidence,decision=EXCLUDED.decision,rationale=EXCLUDED.rationale,created_at=now() RETURNING *`,[version,b.source_feature_id,b.target_feature_id,iou,b.source_overlap_ratio??null,b.target_overlap_ratio??null,identity,combined,c,d,rationale]);
  return res.status(201).json(rows[0]);
}