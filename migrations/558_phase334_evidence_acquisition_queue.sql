CREATE TABLE IF NOT EXISTS gis_evidence_acquisition_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crosswalk_version TEXT NOT NULL,
  source_feature_id TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'HIGH',
  missing_geometry BOOLEAN NOT NULL DEFAULT true,
  missing_intersection BOOLEAN NOT NULL DEFAULT true,
  missing_identity_evidence BOOLEAN NOT NULL DEFAULT false,
  required_provider TEXT,
  required_dataset TEXT,
  required_evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'OPEN',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(crosswalk_version, source_feature_id)
)