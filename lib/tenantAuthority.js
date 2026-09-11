import { db } from 'hatchable';

const ROLE_PERMISSIONS = {
  OWNER: new Set(['*']),
  ADMIN: new Set(['*']),
  MANAGER: new Set(['organization:read','project:read','asset:read','evidence:read','capital:read','opportunity:read']),
  ANALYST: new Set(['organization:read','project:read','asset:read','evidence:read','capital:read','opportunity:read']),
  USER: new Set(['organization:read','project:read','asset:read','evidence:read','capital:read','opportunity:read']),
  VIEWER: new Set(['organization:read','project:read','asset:read','evidence:read','capital:read','opportunity:read'])
};

function callerId(req) {
  return String(req?.member?.id || req?.user?.id || '').trim();
}

export async function resolveTenant(req, organizationId) {
  const memberId = callerId(req);
  const orgId = String(organizationId || '').trim();
  if (!memberId || !orgId) return { allowed:false, reason:'missing_identity_or_organization' };

  const result = await db.query(`
    SELECT o.id AS organization_id,o.name AS organization_name,o.slug,o.status AS organization_status,
           m.id AS membership_id,m.member_id,m.role,m.status AS membership_status,
           p.position_code,p.position_name,p.dashboard_key
    FROM gis_organizations o
    JOIN gis_organization_members m ON m.organization_id=o.id
    LEFT JOIN gis_organization_positions p
      ON p.organization_id=o.id AND p.position_code=CASE WHEN m.role IN ('OWNER','ADMIN') THEN 'CEO' ELSE NULL END
     AND p.status='ACTIVE'
    WHERE o.id=$1 AND o.status='ACTIVE' AND m.member_id=$2 AND m.status='ACTIVE'
    LIMIT 1`, [orgId, memberId]);

  const row = result.rows[0];
  if (!row) return { allowed:false, reason:'organization_access_denied', member_id:memberId, organization_id:orgId };

  return {
    allowed:true,
    member_id:memberId,
    organization_id:row.organization_id,
    organization_name:row.organization_name,
    role:String(row.role || 'VIEWER').toUpperCase(),
    position_code:row.position_code || null,
    position_name:row.position_name || null,
    dashboard_key:row.dashboard_key || null,
    membership_id:row.membership_id
  };
}

export async function authorizeTenant(req, organizationId, permission='organization:read') {
  const tenant = await resolveTenant(req, organizationId);
  if (!tenant.allowed) return tenant;
  const role = tenant.role;
  // Unknown canonical roles fail closed; never fall back to a permissive role.
  const permissions = ROLE_PERMISSIONS[role] || new Set();
  const allowed = permissions.has('*') || permissions.has(permission);
  return allowed ? { ...tenant, permission, permission_allowed:true } : { ...tenant, allowed:false, permission, permission_allowed:false, reason:'permission_denied' };
}

export function tenantError(res, authz) {
  const status = authz?.reason === 'permission_denied' ? 403 : 403;
  return res.status(status).json({ error: authz?.reason || 'organization_access_denied' });
}

export { callerId };