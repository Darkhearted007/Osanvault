CREATE TABLE IF NOT EXISTS evidence_chain_certification_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phase text NOT NULL,
  observed_at timestamptz NOT NULL DEFAULT now(),
  checks jsonb NOT NULL DEFAULT '[]'::jsonb,
  complete boolean NOT NULL DEFAULT false,
  production_gate text NOT NULL,
  notes text
)