CREATE TABLE IF NOT EXISTS cac_filing_evidence_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 event_type text NOT NULL,
 description text NOT NULL,
 actor text,
 created_at timestamptz NOT NULL DEFAULT now()
)