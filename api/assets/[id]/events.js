import { db } from 'hatchable';
import { authorizeAssetTenant } from 'lib/assetTenantAuthority.js';
import { tenantError } from 'lib/tenantAuthority.js';
export const access='admin';
export const methods=['GET'];
export default async function(req,res){
  const id=String(req.params?.id||'').trim();
  const asset=await db.query('SELECT id FROM assets WHERE id=$1',[id]);
  if(!asset.rows.length)return res.status(404).json({error:'Asset not found'});
  const tenant=await authorizeAssetTenant(req,id,'asset:read');
  if(!tenant.allowed)return tenantError(res,tenant);
  const {rows}=await db.query('SELECT id,event_type AS "eventType",actor,payload,created_at AS "createdAt" FROM asset_events WHERE asset_id=$1 ORDER BY created_at DESC LIMIT 100',[id]);
  res.json(rows);
}