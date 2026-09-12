DO $$
BEGIN
  ALTER TABLE gis_exception_candidate_matches
    ADD COLUMN IF NOT EXISTS source_dataset_key text,
    ADD COLUMN IF NOT EXISTS source_provider text,
    ADD COLUMN IF NOT EXISTS source_feature_id text,
    ADD COLUMN IF NOT EXISTS source_artifact_id uuid,
    ADD COLUMN IF NOT EXISTS source_artifact_sha256 text,
    ADD COLUMN IF NOT EXISTS source_feature_level text,
    ADD COLUMN IF NOT EXISTS source_record_hash text,
    ADD COLUMN IF NOT EXISTS source_geometry_hash text,
    ADD COLUMN IF NOT EXISTS generation_run_id text,
    ADD COLUMN IF NOT EXISTS source_lineage_status text NOT NULL DEFAULT 'LEGACY_LINEAGE_UNVERIFIED',
    ADD COLUMN IF NOT EXISTS source_lineage_note text;

  UPDATE gis_exception_candidate_matches
  SET source_lineage_status='HISTORICAL_IDENTITY_LOST',
      source_lineage_note='Historical candidate predates lineage guard. Surviving ledger evidence preserves only State/LGA/area-code identity; no specific source feature/artifact/record/geometry key was recovered. Candidate remains CANDIDATE_ONLY and is not eligible for promotion from this lineage state.'
  WHERE created_at < TIMESTAMPTZ '2026-09-12T00:00:00Z'
    AND source_lineage_status='LEGACY_LINEAGE_UNVERIFIED';

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname='gis_candidate_source_lineage_status_ck'
      AND conrelid='gis_exception_candidate_matches'::regclass
  ) THEN
    ALTER TABLE gis_exception_candidate_matches
      ADD CONSTRAINT gis_candidate_source_lineage_status_ck
      CHECK (source_lineage_status IN ('COMPLETE','HISTORICAL_IDENTITY_LOST','LEGACY_LINEAGE_UNVERIFIED'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname='gis_require_candidate_source_lineage'
  ) THEN
    CREATE FUNCTION gis_require_candidate_source_lineage() RETURNS trigger
    LANGUAGE plpgsql
    AS $fn$
    BEGIN
      IF NEW.source_lineage_status <> 'COMPLETE'
         OR NULLIF(BTRIM(NEW.source_dataset_key),'') IS NULL
         OR NULLIF(BTRIM(NEW.source_provider),'') IS NULL
         OR NULLIF(BTRIM(NEW.source_feature_id),'') IS NULL
         OR NEW.source_artifact_id IS NULL
         OR NULLIF(BTRIM(NEW.source_artifact_sha256),'') IS NULL
         OR NULLIF(BTRIM(NEW.source_feature_level),'') IS NULL
         OR NULLIF(BTRIM(NEW.source_record_hash),'') IS NULL
         OR NULLIF(BTRIM(NEW.source_geometry_hash),'') IS NULL
         OR NULLIF(BTRIM(NEW.generation_run_id),'') IS NULL
      THEN
        RAISE EXCEPTION 'candidate source lineage is incomplete: new GIS candidates must preserve dataset, provider, source feature, artifact, record, geometry and generation-run identity';
      END IF;
      RETURN NEW;
    END;
    $fn$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname='gis_candidate_source_lineage_insert_guard'
      AND tgrelid='gis_exception_candidate_matches'::regclass
  ) THEN
    CREATE TRIGGER gis_candidate_source_lineage_insert_guard
      BEFORE INSERT ON gis_exception_candidate_matches
      FOR EACH ROW EXECUTE FUNCTION gis_require_candidate_source_lineage();
  END IF;
END $$;