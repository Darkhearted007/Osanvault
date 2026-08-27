CREATE TABLE IF NOT EXISTS recruitment_data_model_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phase text NOT NULL,
  observed_at timestamptz NOT NULL DEFAULT now(),
  schema_name text NOT NULL,
  candidate_count integer NOT NULL DEFAULT 0,
  accepted_offer_count integer NOT NULL DEFAULT 0,
  people_record_count integer NOT NULL DEFAULT 0,
  onboarding_case_count integer NOT NULL DEFAULT 0,
  conversion_endpoint_access text NOT NULL,
  decision text NOT NULL,
  notes text
)