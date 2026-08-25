CREATE TABLE IF NOT EXISTS gis_phase3865_review_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_feature_id uuid NOT NULL,
  target_feature_id uuid,
  issue_type text NOT NULL,
  priority text NOT NULL DEFAULT 'MEDIUM',
  status text NOT NULL DEFAULT 'OPEN',
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  reviewer_id text,
  reviewer_decision text,
  rationale text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(source_feature_id, issue_type)
)