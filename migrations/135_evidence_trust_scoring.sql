ALTER TABLE economic_evidence_vault ADD COLUMN IF NOT EXISTS trust_score numeric(5,2);
ALTER TABLE economic_evidence_vault ADD COLUMN IF NOT EXISTS verification_notes text;
ALTER TABLE economic_evidence_vault ADD COLUMN IF NOT EXISTS verified_by text;
ALTER TABLE economic_evidence_vault ADD COLUMN IF NOT EXISTS verified_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_evidence_verification_status ON economic_evidence_vault(verification_status);