CREATE TABLE IF NOT EXISTS system_critical_workflow_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phase text NOT NULL,
  observed_at timestamptz NOT NULL DEFAULT now(),
  checks jsonb NOT NULL DEFAULT '[]'::jsonb,
  blockers jsonb NOT NULL DEFAULT '[]'::jsonb,
  decision text NOT NULL,
  notes text
)