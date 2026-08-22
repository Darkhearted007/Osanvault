CREATE TABLE cac_director_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  director_id uuid NOT NULL REFERENCES cac_director_profiles(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  sent_at timestamptz,
  opened_at timestamptz,
  responded_at timestamptz,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
)