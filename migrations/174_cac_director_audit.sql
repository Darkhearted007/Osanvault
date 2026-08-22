CREATE TABLE cac_director_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  director_id uuid NOT NULL REFERENCES cac_director_profiles(id) ON DELETE CASCADE,
  invite_id uuid REFERENCES cac_director_invites(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  actor text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
)