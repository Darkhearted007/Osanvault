CREATE TABLE IF NOT EXISTS gis_phase39128_provenance_gate_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phase text NOT NULL,
  source_key text NOT NULL,
  source_registry_id uuid,
  artifact_id uuid,
  artifact_sha256 text,
  artifact_retrieval_status text,
  artifact_verification_status text,
  artifact_provenance_status text,
  parsed_records integer NOT NULL DEFAULT 0,
  validated_candidates integer NOT NULL DEFAULT 0,
  qualifying_evidence integer NOT NULL DEFAULT 0,
  reviewed_candidates integer NOT NULL DEFAULT 0,
  promoted_candidates integer NOT NULL DEFAULT 0,
  production_gate text NOT NULL,
  blockers jsonb NOT NULL DEFAULT '[]'::jsonb,
  observed_at timestamptz NOT NULL DEFAULT now()
)