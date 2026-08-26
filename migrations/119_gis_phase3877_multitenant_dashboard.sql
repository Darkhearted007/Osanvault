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

CREATE TABLE IF NOT EXISTS gis_organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES gis_organizations(id) ON DELETE CASCADE,
  member_id text NOT NULL,
  role text NOT NULL DEFAULT 'ANALYST',
  status text NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id,member_id)
);

CREATE TABLE IF NOT EXISTS gis_organization_dashboards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES gis_organizations(id) ON DELETE CASCADE,
  dashboard_key text NOT NULL,
  position_code text,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id,dashboard_key,position_code)
);

CREATE TABLE IF NOT EXISTS gis_organization_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES gis_organizations(id) ON DELETE CASCADE,
  asset_id text NOT NULL,
  access_level text NOT NULL DEFAULT 'READ',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id,asset_id)
);

CREATE TABLE IF NOT EXISTS gis_organization_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES gis_organizations(id) ON DELETE CASCADE,
  member_id text,
  action text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS gis_org_members_member_idx ON gis_organization_members(member_id);
CREATE INDEX IF NOT EXISTS gis_org_assets_org_idx ON gis_organization_assets(organization_id);
CREATE INDEX IF NOT EXISTS gis_org_dashboards_org_idx ON gis_organization_dashboards(organization_id);

ALTER TABLE gis_organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE gis_organization_dashboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE gis_organization_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE gis_organization_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gis_org_members_self ON gis_organization_members;
CREATE POLICY gis_org_members_self ON gis_organization_members USING (member_id = current_setting('app.current_member_id',true));
DROP POLICY IF EXISTS gis_org_dashboards_member ON gis_organization_dashboards;
CREATE POLICY gis_org_dashboards_member ON gis_organization_dashboards USING (organization_id IN (SELECT organization_id FROM gis_organization_members WHERE member_id=current_setting('app.current_member_id',true) AND status='ACTIVE'));
DROP POLICY IF EXISTS gis_org_assets_member ON gis_organization_assets;
CREATE POLICY gis_org_assets_member ON gis_organization_assets USING (organization_id IN (SELECT organization_id FROM gis_organization_members WHERE member_id=current_setting('app.current_member_id',true) AND status='ACTIVE'));
DROP POLICY IF EXISTS gis_org_audit_member ON gis_organization_audit;
CREATE POLICY gis_org_audit_member ON gis_organization_audit USING (organization_id IN (SELECT organization_id FROM gis_organization_members WHERE member_id=current_setting('app.current_member_id',true)));