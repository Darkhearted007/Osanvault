CREATE TABLE IF NOT EXISTS cac_registration_checklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES cac_registration_cases(id) ON DELETE CASCADE,
  code text NOT NULL,
  title text NOT NULL,
  category text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  required boolean NOT NULL DEFAULT true,
  notes text,
  evidence_url text,
  completed_by text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(case_id, code)
)