ALTER TABLE economic_decision_execution ADD COLUMN IF NOT EXISTS outcome_status text;
ALTER TABLE economic_decision_execution ADD COLUMN IF NOT EXISTS outcome_rating numeric(5,2);
ALTER TABLE economic_decision_execution ADD COLUMN IF NOT EXISTS completion_notes text;
ALTER TABLE economic_decision_execution ADD COLUMN IF NOT EXISTS completed_at timestamptz;
CREATE TABLE IF NOT EXISTS economic_intelligence_feedback (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), execution_id uuid NOT NULL, profile_id uuid NOT NULL, outcome_rating numeric(5,2) NOT NULL, outcome_status text NOT NULL, feedback_signal numeric(5,2) NOT NULL, lessons jsonb NOT NULL DEFAULT '[]'::jsonb, created_by text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS idx_intelligence_feedback_profile ON economic_intelligence_feedback(profile_id,created_at DESC);