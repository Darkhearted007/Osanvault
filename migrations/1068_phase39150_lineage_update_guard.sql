DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='gis_candidate_source_lineage_insert_guard' AND tgrelid='gis_exception_candidate_matches'::regclass) THEN
    DROP TRIGGER gis_candidate_source_lineage_insert_guard ON gis_exception_candidate_matches;
  END IF;

  CREATE TRIGGER gis_candidate_source_lineage_insert_guard
    BEFORE INSERT OR UPDATE ON gis_exception_candidate_matches
    FOR EACH ROW EXECUTE FUNCTION gis_require_candidate_source_lineage();
END $$;

CREATE TABLE IF NOT EXISTS gis_historical_candidate_recovery_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_match_id uuid NOT NULL UNIQUE,
  state_name text NOT NULL,
  lga_name text NOT NULL,
  candidate_area_code text,
  source_lineage_status text NOT NULL,
  recovery_status text NOT NULL DEFAULT 'BLOCKED_PENDING_SOURCE_ARTIFACT',
  required_identity_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  recovered_identity jsonb NOT NULL DEFAULT '{}'::jsonb,
  blocker text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO gis_historical_candidate_recovery_queue
  (candidate_match_id,state_name,lga_name,candidate_area_code,source_lineage_status,recovery_status,required_identity_fields,recovered_identity,blocker)
SELECT id,state_name,lga_name,candidate_area_code,source_lineage_status,'BLOCKED_PENDING_SOURCE_ARTIFACT',
       '["source_dataset_key","source_provider","source_feature_id","source_artifact_id","source_artifact_sha256","source_feature_level","source_record_hash","source_geometry_hash","generation_run_id"]'::jsonb,
       '{}'::jsonb,
       'Historical candidate identity was reduced to State/LGA/area-code before lineage preservation existed; no authoritative historical source feature/artifact/record/geometry key has been recovered.'
FROM gis_exception_candidate_matches
WHERE source_lineage_status='HISTORICAL_IDENTITY_LOST'
ON CONFLICT(candidate_match_id) DO NOTHING;

CREATE INDEX IF NOT EXISTS gis_historical_candidate_recovery_status_idx
  ON gis_historical_candidate_recovery_queue(recovery_status,created_at);