-- Preserve historical INEC artifacts while allowing immutable source-bound snapshots.
-- Do not delete or rewrite existing artifact rows.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname='inec_official_artifacts_source_url_key') THEN
    ALTER TABLE inec_official_artifacts DROP CONSTRAINT inec_official_artifacts_source_url_key;
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS inec_official_artifacts_source_url_sha256_key ON inec_official_artifacts(source_url, sha256) WHERE sha256 IS NOT NULL;