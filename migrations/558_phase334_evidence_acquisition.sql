CREATE TABLE IF NOT EXISTS gis_evidence_acquisition_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crosswalk_version TEXT NOT NULL,
  source_feature_id TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'HIGH',
  missing_evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  required_source_providers JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'OPEN',
  resolution_blocker TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(crosswalk_version, source_feature_id)
)