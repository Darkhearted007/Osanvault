-- Forward-only compatibility repair for commercial evidence review fields.
ALTER TABLE commercial_workspace_request_evidence
  ADD COLUMN IF NOT EXISTS reviewed_by text;
ALTER TABLE commercial_workspace_request_evidence
  ADD COLUMN IF NOT EXISTS storage_url text;
ALTER TABLE commercial_workspace_request_evidence
  ALTER COLUMN verification_status SET DEFAULT 'PENDING';
