import { db } from 'hatchable';
import { authorizeTenant } from './tenantAuthority.js';

export async function authorizeAssetTenant(req, assetId, permission='asset:read') {
  const id = String(assetId || '').trim();
  const caller = String(req?.member?.id || req?.user?.id || '').trim();
  if (!id || !caller) return { allowed:false, reason:'missing_identity_or_asset' };
  const { rows } = await db.query(`
    SELECT oa.organization_id
    FROM gis_organization_assets oa
    JOIN gis_organization_members m
      ON m.organization_id = oa.organization_id
     AND m.member_id = $2
     AND m.status = 'ACTIVE'
    WHERE oa.asset_id = $1
    LIMIT 1
  `, [id, caller]);
  if (!rows.length) return { allowed:false, reason:'asset_not_tenant_assigned' };
  return authorizeTenant(req, rows[0].organization_id, permission);
}