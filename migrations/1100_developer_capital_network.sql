ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES gis_organizations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS development_stage text,
  ADD COLUMN IF NOT EXISTS units integer,
  ADD COLUMN IF NOT EXISTS development_scope text,
  ADD COLUMN IF NOT EXISTS estimated_completion date,
  ADD COLUMN IF NOT EXISTS ownership_control_relationship text,
  ADD COLUMN IF NOT EXISTS capital_preferences jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS submission_source text NOT NULL DEFAULT 'system',
  ADD COLUMN IF NOT EXISTS submitted_by text;