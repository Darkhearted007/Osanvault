CREATE TABLE IF NOT EXISTS gis_authoritative_acquisition_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crosswalk_version TEXT NOT NULL,
  provider TEXT NOT NULL,
  dataset_name TEXT NOT NULL,
  source_url TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'STARTED',
  features_examined INTEGER NOT NULL DEFAULT 0,
  features_imported INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  notes JSONB NOT NULL DEFAULT '{}'::jsonb
)