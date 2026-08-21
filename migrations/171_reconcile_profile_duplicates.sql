DROP INDEX IF EXISTS uq_economic_profile_owner_name;
CREATE UNIQUE INDEX IF NOT EXISTS uq_economic_profile_owner_name ON economic_onboarding_profiles(owner_id,lower(display_name),id);