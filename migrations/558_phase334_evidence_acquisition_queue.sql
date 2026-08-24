CREATE TABLE IF NOT EXISTS gis_evidence_acquisition_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crosswalk_version TEXT NOT NULL,
  source_feature_id TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 100,
  required_evidence TEXT NOT NULL,
  missing_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  current_geometry_state TEXT NOT NULL,
  target_candidates_count INTEGER NOT NULL DEFAULT 0,
  requested_provider TEXT,
  status TEXT NOT NULL DEFAULT 'OPEN',
  rationale JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(crosswalk_version, source_feature_id)
)