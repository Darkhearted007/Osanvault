-- Route schema gap repair for the isolated v877 verification lab.
-- These tables hold evidence metadata and audit events only; they do not fabricate evidence files or approvals.

CREATE TABLE IF NOT EXISTS commercial_workspace_request_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES commercial_workspace_requests(id) ON DELETE CASCADE,
  evidence_type text NOT NULL,
  title text NOT NULL,
  source_reference text,
  storage_key text,
  content_hash text,
  verification_status text NOT NULL DEFAULT 'PENDING',
  submitted_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by text,
  review_note text,
  storage_url text
);
CREATE INDEX IF NOT EXISTS idx_commercial_request_evidence_request_created
  ON commercial_workspace_request_evidence(request_id, created_at DESC);

CREATE TABLE IF NOT EXISTS community_evidence_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES community_entities(id) ON DELETE CASCADE,
  asset_id uuid NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  evidence_type text NOT NULL,
  title text NOT NULL,
  description text,
  verification_status text NOT NULL DEFAULT 'UNVERIFIED',
  visibility text NOT NULL DEFAULT 'Restricted',
  submitted_at timestamptz NOT NULL DEFAULT now(),
  submitted_by text,
  source_reference text,
  content_hash text,
  reviewed_at timestamptz,
  reviewer_reference text
);
CREATE INDEX IF NOT EXISTS idx_community_evidence_scope
  ON community_evidence_submissions(community_id, asset_id, submitted_at DESC);

CREATE TABLE IF NOT EXISTS community_consultation_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES community_entities(id) ON DELETE CASCADE,
  asset_id uuid NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  session_type text NOT NULL DEFAULT 'consultation',
  status text NOT NULL DEFAULT 'Planned',
  scheduled_at timestamptz NOT NULL,
  location_summary text,
  agenda_summary text,
  minutes_reference text,
  attendance_summary text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_community_consultation_scope
  ON community_consultation_sessions(community_id, asset_id, scheduled_at DESC);

CREATE TABLE IF NOT EXISTS economic_onboarding_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES economic_onboarding_profiles(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  actor_id text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_economic_onboarding_events_profile_created
  ON economic_onboarding_events(profile_id, created_at DESC);
