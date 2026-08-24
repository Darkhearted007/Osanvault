CREATE TABLE IF NOT EXISTS gis_identity_resolution_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crosswalk_version TEXT NOT NULL,
  source_feature_id TEXT NOT NULL,
  target_feature_id TEXT NOT NULL,
  spatial_iou DOUBLE PRECISION,
  source_overlap_ratio DOUBLE PRECISION,
  target_overlap_ratio DOUBLE PRECISION,
  identity_score DOUBLE PRECISION,
  combined_score DOUBLE PRECISION,
  confidence TEXT NOT NULL DEFAULT 'UNRESOLVED',
  decision TEXT NOT NULL DEFAULT 'UNRESOLVED',
  rationale JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(crosswalk_version, source_feature_id, target_feature_id)
)