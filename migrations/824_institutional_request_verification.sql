-- v824 institutional request verification workflow
ALTER TABLE commercial_workspace_requests ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'NOT_STARTED';
ALTER TABLE commercial_workspace_requests ADD COLUMN IF NOT EXISTS verification_reviewer text;
ALTER TABLE commercial_workspace_requests ADD COLUMN IF NOT EXISTS verification_notes text;
ALTER TABLE commercial_workspace_requests ADD COLUMN IF NOT EXISTS verification_started_at timestamptz;
ALTER TABLE commercial_workspace_requests ADD COLUMN IF NOT EXISTS verification_completed_at timestamptz;
ALTER TABLE commercial_workspace_requests ADD COLUMN IF NOT EXISTS approval_at timestamptz;
ALTER TABLE commercial_workspace_requests ADD COLUMN IF NOT EXISTS rejection_reason text;
CREATE TABLE IF NOT EXISTS commercial_workspace_request_audit (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), request_id uuid NOT NULL, action text NOT NULL, actor text NOT NULL, notes text, created_at timestamptz NOT NULL DEFAULT NOW());