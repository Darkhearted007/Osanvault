CREATE TABLE IF NOT EXISTS gis_organization_dashboard_modules (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id uuid NOT NULL REFERENCES gis_organizations(id) ON DELETE CASCADE,
 dashboard_key text NOT NULL,
 module_key text NOT NULL,
 enabled boolean NOT NULL DEFAULT true,
 config jsonb NOT NULL DEFAULT '{}'::jsonb,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organization_id,dashboard_key,module_key)
)