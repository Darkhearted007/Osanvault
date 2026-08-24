import { db } from "hatchable";

export const access = "admin";
export const methods = ["GET"];

export default async function (req, res) {
  const version = req.query?.crosswalk_version || "phase323-current";
  const { rows } = await db.query(
    `SELECT source_feature_id,
            json_agg(json_build_object(
              'target_feature_id', target_feature_id,
              'target_area_name', target_area_name,
              'target_state_code', target_state_code,
              'iou', iou,
              'sourceOverlap', source_overlap_ratio,
              'targetOverlap', target_overlap_ratio,
              'centroidDistance', centroid_distance,
              'stateMatch', state_match,
              'nameSimilarity', name_similarity,
              'combinedScore', combined_score,
              'confidence', confidence,
              'decision', decision,
              'evidence', evidence
            ) ORDER BY combined_score DESC NULLS LAST) AS candidates
       FROM gis_spatial_identity_evidence
      WHERE crosswalk_version = $1
      GROUP BY source_feature_id
      ORDER BY source_feature_id`,
    [version]
  );
  return res.json({ crosswalk_version: version, rows });
}