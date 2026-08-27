CREATE TABLE IF NOT EXISTS artifact_content_provenance_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phase text NOT NULL,
  artifact_id uuid NOT NULL,
  observed_at timestamptz NOT NULL DEFAULT now(),
  byte_length integer,
  computed_sha256 text,
  recorded_sha256 text,
  hash_match boolean NOT NULL DEFAULT false,
  origin_match boolean NOT NULL DEFAULT false,
  content_type_valid boolean NOT NULL DEFAULT false,
  content_signature_valid boolean NOT NULL DEFAULT false,
  content_characteristics jsonb NOT NULL DEFAULT '{}'::jsonb,
  decision text NOT NULL,
  notes text
)