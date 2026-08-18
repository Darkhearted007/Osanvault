CREATE TABLE IF NOT EXISTS economic_capital_readiness (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  onboarding_id uuid NOT NULL,
  readiness_score numeric(6,3) NOT NULL DEFAULT 0,
  readiness_band text NOT NULL DEFAULT 'developing',
  evidence_coverage numeric(6,3) NOT NULL DEFAULT 0,
  verification_strength numeric(6,3) NOT NULL DEFAULT 0,
  activity_consistency numeric(6,3) NOT NULL DEFAULT 0,
  network_strength numeric(6,3) NOT NULL DEFAULT 0,
  documentation_completeness numeric(6,3) NOT NULL DEFAULT 0,
  capital_fit jsonb NOT NULL DEFAULT '{}'::jsonb,
  gaps jsonb NOT NULL DEFAULT '[]'::jsonb,
  factors jsonb NOT NULL DEFAULT '[]'::jsonb,
  decision_status text NOT NULL DEFAULT 'institutional_review_required',
  calculated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(onboarding_id)
)