import { db } from "hatchable";

export const access = "admin";
export const methods = ["GET", "POST"];

export default async function (req, res) {
  const version = req.query?.crosswalk_version || "phase323-current";
  const limit = Math.min(Math.max(Number(req.query?.limit || 50), 1), 100);
  const offset = Math.max(Number(req.query?.offset || 0), 0);

  if (req.method === "GET") {
    const { rows } = await db.query(
      `SELECT id, crosswalk_version, source_feature_id, target_feature_id,
              source_provider, target_provider, source_area_name, target_area_name,
              source_state_code, target_state_code, source_geometry_valid,
              target_geometry_valid, source_area, target_area, intersection_area,
              source_overlap_ratio, target_overlap_ratio, iou, centroid_distance,
              bbox_overlap, name_similarity, state_match, spatial_score,
              identity_score, combined_score, confidence, decision, evidence, created_at
         FROM gis_spatial_identity_evidence
        WHERE crosswalk_version = $1
        ORDER BY source_feature_id, combined_score DESC NULLS LAST
        LIMIT $2 OFFSET $3`,
      [version, limit, offset]
    );
    return res.json({ crosswalk_version: version, limit, offset, rows });
  }

  const body = req.body || {};
  if (!body.source_feature_id || !body.target_feature_id || !body.source_provider || !body.target_provider) {
    return res.status(400).json({ error: "source_feature_id, target_feature_id, source_provider and target_provider are required" });
  }

  const { rows } = await db.query(
    `INSERT INTO gis_spatial_identity_evidence
      (crosswalk_version, source_feature_id, target_feature_id, source_provider,
       target_provider, source_area_name, target_area_name, source_state_code,
       target_state_code, source_geometry_valid, target_geometry_valid, source_area,
       target_area, intersection_area, source_overlap_ratio, target_overlap_ratio,
       iou, centroid_distance, bbox_overlap, name_similarity, state_match,
       spatial_score, identity_score, combined_score, confidence, decision, evidence)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27)
     ON CONFLICT (crosswalk_version, source_feature_id, target_feature_id)
     DO UPDATE SET evidence = EXCLUDED.evidence, confidence = EXCLUDED.confidence,
       decision = EXCLUDED.decision, combined_score = EXCLUDED.combined_score,
       spatial_score = EXCLUDED.spatial_score, identity_score = EXCLUDED.identity_score,
       created_at = now()
     RETURNING *`,
    [version, body.source_feature_id, body.target_feature_id, body.source_provider,
      body.target_provider, body.source_area_name ?? null, body.target_area_name ?? null,
      body.source_state_code ?? null, body.target_state_code ?? null,
      body.source_geometry_valid ?? null, body.target_geometry_valid ?? null,
      body.source_area ?? null, body.target_area ?? null, body.intersection_area ?? null,
      body.source_overlap_ratio ?? null, body.target_overlap_ratio ?? null,
      body.iou ?? null, body.centroid_distance ?? null, body.bbox_overlap ?? null,
      body.name_similarity ?? null, body.state_match ?? null, body.spatial_score ?? null,
      body.identity_score ?? null, body.combined_score ?? null, body.confidence ?? "UNRESOLVED",
      body.decision ?? "GEOMETRY_DATA_REQUIRED", body.evidence ?? {}]
  );
  return res.status(201).json(rows[0]);
}