CREATE TABLE IF NOT EXISTS economic_activity_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES economic_onboarding_profiles(id) ON DELETE CASCADE,
  activity_date date NOT NULL DEFAULT CURRENT_DATE,
  activity_type text NOT NULL,
  amount numeric(18,2) NOT NULL CHECK (amount >= 0),
  currency text NOT NULL DEFAULT 'NGN',
  description text,
  evidence_status text NOT NULL DEFAULT 'reported',
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_economic_activity_records_profile_date
  ON economic_activity_records(profile_id, activity_date DESC, created_at DESC);
