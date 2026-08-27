CREATE TABLE IF NOT EXISTS business_security_hardening_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phase text NOT NULL,
  observed_at timestamptz NOT NULL DEFAULT now(),
  checks jsonb NOT NULL DEFAULT '[]'::jsonb,
  blockers jsonb NOT NULL DEFAULT '[]'::jsonb,
  decision text NOT NULL,
  production_gate text NOT NULL DEFAULT 'NOT_READY',
  notes text
)