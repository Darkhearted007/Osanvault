ALTER TABLE economic_evidence_vault ADD COLUMN IF NOT EXISTS file_url text;
ALTER TABLE economic_evidence_vault ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'pending';
ALTER TABLE economic_evidence_vault ADD COLUMN IF NOT EXISTS submitted_by text;
ALTER TABLE economic_evidence_vault ADD COLUMN IF NOT EXISTS submitted_at timestamptz NOT NULL DEFAULT now();
CREATE INDEX IF NOT EXISTS idx_evidence_profile_status ON economic_evidence_vault(profile_id,verification_status);