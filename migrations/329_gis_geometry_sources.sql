CREATE TABLE IF NOT EXISTS gis_geometry_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  dataset_name TEXT NOT NULL,
  dataset_version TEXT,
  source_url TEXT,
  geometry_format TEXT,
  geometry_crs TEXT,
  feature_count INTEGER,
  provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'REGISTERED',
  imported_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, dataset_name, dataset_version)
)