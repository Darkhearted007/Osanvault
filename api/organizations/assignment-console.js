import { db } from 'hatchable';
export const access='admin';
export const methods=['GET','POST'];
export default async function(req,res){
 const orgId=req.query?.organization_id||req.body?.organization_id;
 if(req.method==='GET'){
  const organizations=(await db.query("SELECT id,name,slug,organization_type,status FROM gis_organizations ORDER BY name")).rows;
  const positions=(await db.query("SELECT id,organization_id,position_code,position_name,dashboard_key,status FROM gis_organization_positions ORDER BY organization_id,position_name")).rows;
  const assets=(await db.query("SELECT id,organization_id,asset_id,access_level FROM gis_organization_assets ORDER BY organization_id,asset_id")).rows;
  const layers=(await db.query("SELECT id,organization_id,layer_id,access_level,status FROM gis_organization_layer_entitlements ORDER BY organization_id,layer_id")).rows;
  const dashboards=(await db.query("SELECT id,organization_id,dashboard_key,position_code,config FROM gis_organization_dashboards ORDER BY organization_id,dashboard_key,position_code")).rows;
  return res.json({phase:'388.6',organizations,positions,assignments:{assets,layers,dashboards}});
 }
 if(!orgId)return res.status(400).json({error:'organization_id is required'});
 const action=req.body?.action;
 if(action==='ASSIGN_ASSET'){
  const {position_id,asset_id}=req.body;
  if(!position_id||!asset_id)return res.status(400).json({error:'position_id and asset_id are required'});
  const p=(await db.query("SELECT id,organization_id FROM gis_organization_positions WHERE id=$1",[position_id])).rows[0];
  if(!p||p.organization_id!==orgId)return res.status(400).json({error:'position_not_in_organization'});
  await db.query("INSERT INTO gis_organization_assets (organization_id,asset_id) VALUES ($1,$2) ON CONFLICT DO NOTHING",[orgId,asset_id]);
  await db.query("INSERT INTO gis_organization_audit (organization_id,member_id,action,metadata) VALUES ($1,$2,'ASSET_ASSIGNED',$3)",[orgId,req.member.id,JSON.stringify({position_id,asset_id,phase:'388.6'})]);
  return res.json({phase:'388.6',action,organization_id:orgId,position_id,asset_id,idempotent:true});
 }
 if(action==='ASSIGN_LAYER'){
  const {layer_id,access_level='VIEW'}=req.body;
  if(!layer_id)return res.status(400).json({error:'layer_id is required'});
  await db.query("INSERT INTO gis_organization_layer_entitlements (organization_id,layer_id,access_level,status) VALUES ($1,$2,$3,'ACTIVE') ON CONFLICT DO NOTHING",[orgId,layer_id,access_level]);
  await db.query("INSERT INTO gis_organization_audit (organization_id,member_id,action,metadata) VALUES ($1,$2,'LAYER_ASSIGNED',$3)",[orgId,req.member.id,JSON.stringify({layer_id,access_level,phase:'388.6'})]);
  return res.json({phase:'388.6',action,organization_id:orgId,layer_id,access_level,idempotent:true});
 }
 return res.status(400).json({error:'unsupported_action'});
}