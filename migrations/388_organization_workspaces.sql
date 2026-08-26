CREATE TABLE IF NOT EXISTS gis_workspace_access (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id uuid NOT NULL REFERENCES gis_organizations(id) ON DELETE CASCADE,
 member_id uuid NOT NULL,
 position_id uuid REFERENCES gis_organization_positions(id) ON DELETE SET NULL,
 workspace_key text NOT NULL,
 access_level text NOT NULL DEFAULT 'VIEW',
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organization_id,member_id,workspace_key)
)