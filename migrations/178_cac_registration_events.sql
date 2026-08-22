CREATE TABLE IF NOT EXISTS cac_registration_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES cac_registration_cases(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  actor_id text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
)