CREATE TABLE IF NOT EXISTS cac_registration_parties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES cac_registration_cases(id) ON DELETE CASCADE,
  party_type text NOT NULL,
  full_name text NOT NULL,
  email text,
  phone text,
  nationality text,
  occupation text,
  address text,
  share_allocation text,
  id_status text DEFAULT 'pending',
  consent_status text DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
)