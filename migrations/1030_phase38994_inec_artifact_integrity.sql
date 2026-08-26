ALTER TABLE inec_official_artifacts ADD COLUMN IF NOT EXISTS source_registry_id uuid;
ALTER TABLE inec_official_artifacts ADD COLUMN IF NOT EXISTS canonical_source_key text;
ALTER TABLE inec_official_artifacts ADD COLUMN IF NOT EXISTS provenance_status text NOT NULL DEFAULT 'PENDING';
ALTER TABLE inec_official_artifacts ADD COLUMN IF NOT EXISTS artifact_identity text;
UPDATE inec_official_artifacts a SET source_registry_id=c.source_registry_id,canonical_source_key=c.source_key FROM gis_canonical_source_identity c WHERE c.source_key='INEC-POLLING-UNIT-LOCATOR-2026' AND a.source_url='https://www.inecnigeria.org/wp-content/uploads/2023-Polling-Unit-list-Nationwide.pdf';
CREATE INDEX IF NOT EXISTS inec_official_artifacts_canonical_source_idx ON inec_official_artifacts(canonical_source_key);
CREATE UNIQUE INDEX IF NOT EXISTS inec_official_artifacts_identity_uidx ON inec_official_artifacts(artifact_identity) WHERE artifact_identity IS NOT NULL;