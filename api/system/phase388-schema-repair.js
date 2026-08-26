import { db } from 'hatchable';
export const access='admin';
export const methods=['POST'];
export default async function(req,res){
 const statements=[
 "CREATE TABLE IF NOT EXISTS gis_organizations (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, slug text NOT NULL UNIQUE, organization_type text NOT NULL DEFAULT 'ENTERPRISE', status text NOT NULL DEFAULT 'ACTIVE', created_at timestamptz NOT NULL DEFAULT now())",
 "CREATE TABLE IF NOT EXISTS gis_organization_members (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES gis_organizations(id) ON DELETE CASCADE, member_id text NOT NULL, role text NOT NULL DEFAULT 'USER', status text NOT NULL DEFAULT 'ACTIVE', created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(organization_id,member_id))",
 "CREATE TABLE IF NOT EXISTS gis_organization_positions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES gis_organizations(id) ON DELETE CASCADE, position_code text NOT NULL, position_name text NOT NULL, dashboard_key text NOT NULL, status text NOT NULL DEFAULT 'ACTIVE', UNIQUE(organization_id,position_code))",
 "CREATE TABLE IF NOT EXISTS gis_organization_dashboards (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES gis_organizations(id) ON DELETE CASCADE, dashboard_key text NOT NULL, position_code text NOT NULL, config jsonb NOT NULL DEFAULT '{}'::jsonb, UNIQUE(organization_id,dashboard_key,position_code))",
 "CREATE TABLE IF NOT EXISTS gis_organization_assets (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES gis_organizations(id) ON DELETE CASCADE, asset_id text NOT NULL, access_level text NOT NULL DEFAULT 'VIEW', UNIQUE(organization_id,asset_id))",
 "CREATE TABLE IF NOT EXISTS gis_organization_layer_entitlements (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES gis_organizations(id) ON DELETE CASCADE, layer_id text NOT NULL, access_level text NOT NULL DEFAULT 'VIEW', status text NOT NULL DEFAULT 'ACTIVE', UNIQUE(organization_id,layer_id))",
 "CREATE TABLE IF NOT EXISTS gis_organization_audit (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid REFERENCES gis_organizations(id) ON DELETE CASCADE, member_id text, action text NOT NULL, metadata jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now())",
 "CREATE TABLE IF NOT EXISTS gis_organization_invitations (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES gis_organizations(id) ON DELETE CASCADE, invitee_member_id text NOT NULL, role text NOT NULL DEFAULT 'USER', position_code text, token_hash text NOT NULL UNIQUE, status text NOT NULL DEFAULT 'PENDING', expires_at timestamptz NOT NULL, invited_by text, accepted_at timestamptz, revoked_at timestamptz, created_at timestamptz NOT NULL DEFAULT now())",
 "CREATE TABLE IF NOT EXISTS gis_organization_access_events (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid REFERENCES gis_organizations(id) ON DELETE CASCADE, member_id text, actor_member_id text, event_type text NOT NULL, metadata jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now())"
 ];
 for(const sql of statements) await db.query(sql);
 const tables=(await db.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'gis_organization%' ORDER BY table_name")).rows.map(x=>x.table_name);
 res.json({phase:'388-runtime-repair',repaired:true,tables});
}