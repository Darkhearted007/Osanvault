CREATE TABLE IF NOT EXISTS gis_organization_layer_entitlements (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id uuid NOT NULL REFERENCES gis_organizations(id) ON DELETE CASCADE,
 layer_id uuid NOT NULL REFERENCES gis_layers(id) ON DELETE CASCADE,
 access_level text NOT NULL DEFAULT 'VIEW',
 status text NOT NULL DEFAULT 'ACTIVE',
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organization_id,layer_id)
)