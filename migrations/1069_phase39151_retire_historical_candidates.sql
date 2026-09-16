ALTER TABLE gis_exception_candidate_matches ADD COLUMN IF NOT EXISTS certification_scope text NOT NULL DEFAULT 'CURRENT_AUTHORITATIVE_INEC';
ALTER TABLE gis_exception_candidate_matches ADD COLUMN IF NOT EXISTS retirement_status text NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE gis_exception_candidate_matches ADD COLUMN IF NOT EXISTS retired_at timestamptz;
ALTER TABLE gis_exception_candidate_matches ADD COLUMN IF NOT EXISTS retirement_reason text;

-- The lineage guard also protects UPDATE. Historical candidates must be archivable
-- without becoming COMPLETE or acquiring fabricated lineage. Permit only metadata
-- retirement updates while preserving their HISTORICAL_IDENTITY_LOST lineage state.
CREATE OR REPLACE FUNCTION gis_require_candidate_source_lineage() RETURNS trigger
LANGUAGE plpgsql
AS $fn$
BEGIN
  IF NEW.source_lineage_status = 'HISTORICAL_IDENTITY_LOST'
     AND OLD.source_lineage_status = 'HISTORICAL_IDENTITY_LOST'
     AND NEW.source_dataset_key IS NOT DISTINCT FROM OLD.source_dataset_key
     AND NEW.source_provider IS NOT DISTINCT FROM OLD.source_provider
     AND NEW.source_feature_id IS NOT DISTINCT FROM OLD.source_feature_id
     AND NEW.source_artifact_id IS NOT DISTINCT FROM OLD.source_artifact_id
     AND NEW.source_artifact_sha256 IS NOT DISTINCT FROM OLD.source_artifact_sha256
     AND NEW.source_feature_level IS NOT DISTINCT FROM OLD.source_feature_level
     AND NEW.source_record_hash IS NOT DISTINCT FROM OLD.source_record_hash
     AND NEW.source_geometry_hash IS NOT DISTINCT FROM OLD.source_geometry_hash
     AND NEW.generation_run_id IS NOT DISTINCT FROM OLD.generation_run_id
  THEN
    RETURN NEW;
  END IF;

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

UPDATE gis_exception_candidate_matches
SET certification_scope='HISTORICAL_ARCHIVE',
    retirement_status='ARCHIVED_UNRESOLVED',
    retired_at=COALESCE(retired_at,now()),
    retirement_reason=COALESCE(retirement_reason,'Historical candidate preserved for audit/recovery. Original authoritative source lineage was not preserved; no current Ward identity is asserted.')
WHERE source_lineage_status='HISTORICAL_IDENTITY_LOST';

ALTER TABLE gis_historical_candidate_recovery_queue ADD COLUMN IF NOT EXISTS archive_status text NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE gis_historical_candidate_recovery_queue ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE gis_historical_candidate_recovery_queue ADD COLUMN IF NOT EXISTS archive_reason text;

UPDATE gis_historical_candidate_recovery_queue
SET archive_status='ARCHIVED',
    archived_at=COALESCE(archived_at,now()),
    archive_reason=COALESCE(archive_reason,'Historical candidate retired from active production certification. Original authoritative source lineage was not preserved; record retained for audit/history.')
WHERE source_lineage_status='HISTORICAL_IDENTITY_LOST';

CREATE INDEX IF NOT EXISTS gis_exception_candidate_certification_scope_idx ON gis_exception_candidate_matches(certification_scope,retirement_status);
CREATE INDEX IF NOT EXISTS gis_historical_candidate_archive_status_idx ON gis_historical_candidate_recovery_queue(archive_status,created_at);