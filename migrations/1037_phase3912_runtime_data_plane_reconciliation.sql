CREATE TABLE IF NOT EXISTS runtime_data_plane_reconciliation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phase text NOT NULL,
  observed_at timestamptz NOT NULL DEFAULT now(),
  database_name text,
  schema_name text,
  table_observations jsonb NOT NULL DEFAULT '[]'::jsonb,
  contradictions jsonb NOT NULL DEFAULT '[]'::jsonb,
  decision text NOT NULL,
  notes text
)