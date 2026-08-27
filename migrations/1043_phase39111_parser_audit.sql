CREATE TABLE IF NOT EXISTS gis_artifact_parse_audits (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 artifact_id uuid NOT NULL,
 parser_version text NOT NULL,
 parsed_at timestamptz NOT NULL DEFAULT now(),
 artifact_sha256 text,
 records_extracted integer NOT NULL DEFAULT 0,
 errors jsonb NOT NULL DEFAULT '[]'::jsonb,
 status text NOT NULL,
 notes text
)