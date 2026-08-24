CREATE TABLE IF NOT EXISTS gis_phase329_candidate_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crosswalk_version TEXT NOT NULL,
  source_feature_id TEXT NOT NULL,
  target_feature_id TEXT NOT NULL,
  source_provider TEXT,
  target_provider TEXT,
  state_match BOOLEAN,
  name_similarity DOUBLE PRECISION,
  geometry_ready BOOLEAN NOT NULL DEFAULT false,
  scoring_mode TEXT NOT NULL DEFAULT 'METADATA_ONLY',
  score DOUBLE PRECISION,
  confidence TEXT NOT NULL DEFAULT 'UNRESOLVED',
  decision TEXT NOT NULL DEFAULT 'REVIEW_REQUIRED',
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (crosswalk_version, source_feature_id, target_feature_id)
)