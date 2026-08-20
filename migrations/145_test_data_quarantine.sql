ALTER TABLE economic_onboarding_profiles ADD COLUMN IF NOT EXISTS quarantine_reason text;
ALTER TABLE economic_onboarding_profiles ADD COLUMN IF NOT EXISTS quarantined_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_economic_profiles_environment ON economic_onboarding_profiles(data_environment);