ALTER TABLE economic_onboarding_profiles ADD COLUMN IF NOT EXISTS data_environment text NOT NULL DEFAULT 'production';
ALTER TABLE economic_onboarding_profiles ADD COLUMN IF NOT EXISTS business_type text;
ALTER TABLE economic_onboarding_profiles ADD COLUMN IF NOT EXISTS sector text;
ALTER TABLE economic_onboarding_profiles ADD COLUMN IF NOT EXISTS location text;
ALTER TABLE economic_onboarding_profiles ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE economic_onboarding_profiles ADD COLUMN IF NOT EXISTS onboarding_status text NOT NULL DEFAULT 'draft';
CREATE INDEX IF NOT EXISTS idx_economic_profiles_owner_env_status ON economic_onboarding_profiles(owner_id,data_environment,onboarding_status);