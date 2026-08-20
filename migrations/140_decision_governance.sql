ALTER TABLE economic_decision_actions ADD COLUMN IF NOT EXISTS approval_by text;
ALTER TABLE economic_decision_actions ADD COLUMN IF NOT EXISTS approval_at timestamptz;
ALTER TABLE economic_decision_actions ADD COLUMN IF NOT EXISTS approval_notes text;
CREATE TABLE IF NOT EXISTS economic_decision_governance_events (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), decision_action_id uuid NOT NULL, profile_id uuid NOT NULL, event_type text NOT NULL, from_state text, to_state text, actor_id text NOT NULL, notes text, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS idx_decision_governance_action ON economic_decision_governance_events(decision_action_id,created_at DESC);