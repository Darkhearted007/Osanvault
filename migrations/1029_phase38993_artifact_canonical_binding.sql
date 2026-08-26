ALTER TABLE gis_official_artifacts ADD COLUMN IF NOT EXISTS source_registry_id uuid;
ALTER TABLE gis_official_artifacts ADD COLUMN IF NOT EXISTS source_url text;
ALTER TABLE gis_official_artifacts ADD COLUMN IF NOT EXISTS acquisition_at timestamptz;
ALTER TABLE gis_official_artifacts ADD COLUMN IF NOT EXISTS provenance_status text NOT NULL DEFAULT 'PENDING';
UPDATE gis_official_artifacts a SET source_registry_id=c.source_registry_id,source_url=c.source_url,acquisition_at=COALESCE(a.acquisition_at,a.created_at) FROM gis_canonical_source_identity c WHERE a.source_key=c.source_key AND a.source_registry_id IS NULL;
CREATE INDEX IF NOT EXISTS gis_official_artifacts_source_registry_idx ON gis_official_artifacts(source_registry_id);