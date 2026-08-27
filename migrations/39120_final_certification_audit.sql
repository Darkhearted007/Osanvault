CREATE TABLE IF NOT EXISTS gis_inec_final_certification_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reconciliation_id uuid NOT NULL,
  candidate_match_id uuid NOT NULL,
  previous_status text NOT NULL,
  proposed_status text NOT NULL,
  final_decision text NOT NULL,
  evidence_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  artifact_id text,
  artifact_sha256 text,
  provenance_reference jsonb,
  reviewer_reference text,
  authorization_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  deterministic_fingerprint text NOT NULL,
  event_type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (deterministic_fingerprint, event_type)
) ;