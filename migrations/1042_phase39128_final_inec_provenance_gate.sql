CREATE TABLE IF NOT EXISTS gis_final_provenance_gate_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phase text NOT NULL,
  source_id uuid NOT NULL,
  source_key text NOT NULL,
  artifact_id uuid,
  recorded_sha256 text,
  recomputed_sha256 text,
  byte_size integer,
  content_type text,
  provenance_status text,
  integrity_status text,
  parsed_records integer NOT NULL DEFAULT 0,
  verified_candidates integer NOT NULL DEFAULT 0,
  reviewed_candidates integer NOT NULL DEFAULT 0,
  promoted_candidates integer NOT NULL DEFAULT 0,
  production_gate text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
)