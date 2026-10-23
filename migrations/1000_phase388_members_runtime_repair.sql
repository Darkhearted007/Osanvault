CREATE TABLE IF NOT EXISTS gis_organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  organization_type text NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE',
  dashboard_mode text NOT NULL DEFAULT 'COMPANY',
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS gis_organization_members (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES gis_organizations(id) ON DELETE CASCADE, member_id text NOT NULL, role text NOT NULL DEFAULT 'USER', status text NOT NULL DEFAULT 'ACTIVE', created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(organization_id,member_id));