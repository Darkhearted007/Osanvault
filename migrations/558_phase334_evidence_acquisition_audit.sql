CREATE TABLE IF NOT EXISTS gis_evidence_acquisition_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crosswalk_version TEXT NOT NULL,
  scanned_open INTEGER NOT NULL DEFAULT 0,
  critical INTEGER NOT NULL DEFAULT 0,
  geometry_blocked INTEGER NOT NULL DEFAULT 0,
  queued INTEGER NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
)