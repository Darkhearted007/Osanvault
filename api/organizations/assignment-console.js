import { db } from 'hatchable';
export const access='admin';
export const methods=['GET','POST'];
export default async function(req,res){
 const orgId=req.query?.organization_id||req.body?.organization_id;
 if(req.method==='GET'){
  const organizations=(await db.query("SELECT id,name,organization_type,status FROM gis_organizations ORDER BY name")).rows;
  const positions=(await db.query("SELECT id,organization_id,position_code,position_name,dashboard_key FROM gis_organization_positions ORDER BY organization_id,position_name")).rows;
  const assets=(await db.query("SELECT id,organization_id,asset_id,access_level,created_at FROM gis_organization_assets ORDER BY organization_id,created_at DESC")).rows;
  const layers=(await db.query("SELECT e.id,e.organization_id,e.layer_id,e.access_level,e.status,l.layer_code,l.layer_name FROM gis_organization_layer_entitlements e JOIN gis_layers l ON l.id=e.layer_id ORDER BY e.organization_id,l.layer_name")).rows;
  return res.json({phase:'388.6',organizations,positions,assetAssignments:assets,layerEntitlements:layers});
 }
 if(!orgId)return res.status(400).json({error:'organization_id is required'});
 const action=req.body?.action;
 if(action==='ASSIGN_ASSET'){
  const assetId=String(req.body?.asset_id||'').trim();
  const positionId=req.body?.position_id||null;
  if(!assetId)return res.status(400).json({error:'asset_id is required'});
  if(positionId){const p=(await db.query("SELECT id,organization_id FROM gis_organization_positions WHERE id=$1",[positionId])).rows[0];if(!p||p.organization_id!==orgId)return res.status(400).json({error:'position_not_in_organization'});}
  const existing=(await db.query("SELECT id FROM gis_organization_assets WHERE organization_id=$1 AND asset_id=$2",[orgId,assetId])).rows[0];
  if(existing)return res.json({phase:'388.6',action,organization_id:orgId,asset_id:assetId,position_id:positionId,assignment_id:existing.id,created:false,idempotent:true});
  const created=(await db.query("INSERT INTO gis_organization_assets (organization_id,asset_id,access_level) VALUES ($1,$2,$3) RETURNING id,organization_id,asset_id,access_level,created_at",[orgId,assetId,req.body?.access_level||'VIEW'])).rows[0];
  await db.query("INSERT INTO gis_organization_audit (organization_id,member_id,action,metadata) VALUES ($1,$2,$3,$4)",[orgId,'platform-admin','ASSET_ASSIGNED',JSON.stringify({asset_id:assetId,position_id:positionId,access_level:created.access_level})]);
  return res.json({phase:'388.6',action,assignment:created,position_id:positionId,created:true,idempotent:true});
 }
 if(action==='ASSIGN_LAYER'){
  const layerId=req.body?.layer_id;
  if(!layerId)return res.status(400).json({error:'layer_id is required'});
  const layer=(await db.query("SELECT id,layer_code,layer_name FROM gis_layers WHERE id=$1 AND verification_status='Verified' AND status='Active'",[layerId])).rows[0];
  if(!layer)return res.status(400).json({error:'layer_not_verified_or_active'});
  const existing=(await db.query("SELECT id FROM gis_organization_layer_entitlements WHERE organization_id=$1 AND layer_id=$2",[orgId,layerId])).rows[0];
  if(existing)return res.json({phase:'388.6',action,organization_id:orgId,layer,entitlement_id:existing.id,created:false,idempotent:true});
  const created=(await db.query("INSERT INTO gis_organization_layer_entitlements (organization_id,layer_id,access_level,status) VALUES ($1,$2,$3,'ACTIVE') RETURNING id,organization_id,layer_id,access_level,status,created_at",[orgId,layerId,req.body?.access_level||'VIEW'])).rows[0];
  await db.query("INSERT INTO gis_organization_audit (organization_id,member_id,action,metadata) VALUES ($1,$2,$3,$4)",[orgId,'platform-admin','LAYER_ASSIGNED',JSON.stringify({layer_id:layerId,layer_code:layer.layer_code,access_level:created.access_level})]);
  return res.json({phase:'388.6',action,entitlement:created,layer,created:true,idempotent:true});
 }
 return res.status(400).json({error:'unsupported_action'});
}