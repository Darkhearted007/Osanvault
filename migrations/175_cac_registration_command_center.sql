CREATE TABLE IF NOT EXISTS cac_registration_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL DEFAULT 'OSANVAULT AFRICA LTD',
  status text NOT NULL DEFAULT 'pre_filing',
  share_capital text,
  registered_office text,
  name_reservation_status text DEFAULT 'pending',
  cac_submission_reference text,
  cac_query text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
)