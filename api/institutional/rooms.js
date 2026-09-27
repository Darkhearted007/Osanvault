import { db } from 'hatchable';
import { authorizeTenant, tenantError } from 'lib/tenantAuthority.js';
export const access='member';
export const methods=['GET','POST'];
export default async function(req,res){
 const member=req.member;
 if(req.method==='GET'){
  const r=await db.query('SELECT d.id,d.asset_id AS "assetId",d.institution_id AS "institutionId",d.name,d.status,d.created_at AS "createdAt" FROM institutional_data_rooms d JOIN gis_organization_assets oa ON oa.asset_id=d.asset_id JOIN gis_organization_members gm ON gm.organization_id=oa.organization_id WHERE gm.member_id=$1 AND gm.status=$2 ORDER BY d.created_at DESC',[member.id,'ACTIVE']);
  return res.json(r.rows);
 }
 const b=req.body||{}; if(!b.assetId||!b.institutionId||!b.name)return res.status(400).json({error:'assetId, institutionId and name are required'});
 const oa=await db.query('SELECT organization_id AS "organizationId" FROM gis_organization_assets WHERE asset_id=$1 LIMIT 1',[b.assetId]);
 if(!oa.rows.length)return res.status(403).json({error:'asset_not_tenant_assigned'});
 const tenant=await authorizeTenant(req,oa.rows[0].organizationId,'capital:write'); if(!tenant.allowed)return tenantError(res,tenant);
 const a=await db.query('SELECT id FROM assets WHERE id=$1',[b.assetId]); if(!a.rows.length)return res.status(404).json({error:'Asset not found'});
 const inst=await db.query("SELECT id FROM institutional_profiles WHERE id=$1 AND status='active'",[b.institutionId]); if(!inst.rows.length)return res.status(404).json({error:'Institution not found'});
 const r=await db.query('INSERT INTO institutional_data_rooms(asset_id,institution_id,name,created_by) VALUES($1,$2,$3,$4) ON CONFLICT(asset_id,institution_id) DO UPDATE SET name=EXCLUDED.name,updated_at=now() RETURNING id,asset_id AS "assetId",institution_id AS "institutionId",name,status,created_at AS "createdAt"',[b.assetId,b.institutionId,b.name,member.id]);
 await db.query('INSERT INTO data_room_audit(room_id,action,actor_id,metadata) VALUES($1,$2,$3,$4)',[r.rows[0].id,'ROOM_CREATED',member.id,JSON.stringify({assetId:b.assetId,institutionId:b.institutionId})]);
 res.status(201).json(r.rows[0]);
}