-- Align commercial request detail and community portal with the canonical schema.
ALTER TABLE commercial_workspace_requests
  ADD COLUMN IF NOT EXISTS official_website text,
  ADD COLUMN IF NOT EXISTS official_domain text,
  ADD COLUMN IF NOT EXISTS intended_use text,
  ADD COLUMN IF NOT EXISTS geography_of_interest text;

ALTER TABLE community_grievances
  ADD COLUMN IF NOT EXISTS community_id uuid REFERENCES community_entities(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_community_grievances_scope
  ON community_grievances(community_id, asset_id, opened_at DESC)
  WHERE community_id IS NOT NULL;
