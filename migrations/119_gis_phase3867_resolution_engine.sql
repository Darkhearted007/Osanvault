ALTER TABLE gis_phase3865_review_queue ADD COLUMN IF NOT EXISTS classification text;
ALTER TABLE gis_phase3865_review_queue ADD COLUMN IF NOT EXISTS auto_resolution text;
ALTER TABLE gis_phase3865_review_queue ADD COLUMN IF NOT EXISTS confidence numeric;
ALTER TABLE gis_phase3865_review_queue ADD COLUMN IF NOT EXISTS triage_reason text;
CREATE INDEX IF NOT EXISTS idx_gis_phase3865_review_queue_classification ON gis_phase3865_review_queue(status,classification);