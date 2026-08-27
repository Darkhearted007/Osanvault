CREATE TABLE IF NOT EXISTS gis_authoritative_matching_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phase text NOT NULL,
  artifact_id uuid,
  artifact_sha256 text,
  canonical_source_key text NOT NULL,
  candidate_count integer NOT NULL DEFAULT 0,
  matched_count integer NOT NULL DEFAULT 0,
  exact_match_count integer NOT NULL DEFAULT 0,
  ambiguous_count integer NOT NULL DEFAULT 0,
  checks jsonb NOT NULL DEFAULT '[]'::jsonb,
  observed_at timestamptz NOT NULL DEFAULT now(),
  production_gate text NOT NULL,
  notes text
)