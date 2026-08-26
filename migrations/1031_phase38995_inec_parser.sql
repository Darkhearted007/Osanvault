ALTER TABLE gis_official_artifact_rows ADD COLUMN IF NOT EXISTS source_page text;
ALTER TABLE gis_official_artifact_rows ADD COLUMN IF NOT EXISTS delimitation_code text;
ALTER TABLE gis_official_artifact_rows ADD COLUMN IF NOT EXISTS polling_unit_code text;
ALTER TABLE gis_official_artifact_rows ADD COLUMN IF NOT EXISTS polling_unit_name text;
CREATE INDEX IF NOT EXISTS gis_official_artifact_rows_code_idx ON gis_official_artifact_rows(polling_unit_code,ward_code);