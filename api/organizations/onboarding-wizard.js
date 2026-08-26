import { db } from 'hatchable';
export const access='admin';
export const methods=['GET','POST'];
const DEFAULTS=[['EXECUTIVE','Executive','executive'],['OPERATIONS','Operations','operations'],['ANALYST','Analyst','analyst'],['REGULATOR','Regulator','regulator'],['INVESTOR','Investor','investor']];
export default async function(req,res){
 if(req.method==='GET'){
  const orgs=(await db.query("SELECT id,name,slug,organization_type AS \"organizationType\",status FROM gis_organizations ORDER BY name")).rows;
  const layers=(await db.query("SELECT id,name,status,verification_status AS \"verificationStatus\" FROM gis_layers WHERE status='Active' AND verification_status='Verified' ORDER BY name")).rows;
  return res.json({phase:'388.7',organizations:orgs,availableLayers:layers,steps:['organization','positions','dashboards','assets','gisLayers','launch']});
 }
 const b=req.body||{};
 if(!b.name||!b.slug||!b.organizationType)return res.status(400).json({error:'name, slug and organizationType are required'});
 const slug=String(b.slug).trim().toLowerCase();
 const existing=(await db.query("SELECT id FROM gis_organizations WHERE slug=$1",[slug])).rows[0];
 if(existing)return res.status(409).json({error:'organization_slug_exists',organizationId:existing.id});
 const org=(await db.query("INSERT INTO gis_organizations(name,slug,organization_type,created_by) VALUES($1,$2,$3,$4) RETURNING id,name,slug,organization_type AS \"organizationType\",status",[b.name.trim(),slug,b.organizationType,req.member.id])).rows[0];
 for(const [code,name,key] of DEFAULTS){
  const r=await db.query("INSERT INTO gis_organization_positions(organization_id,position_code,position_name,dashboard_key) VALUES($1,$2,$3,$4) ON CONFLICT(organization_id,position_code) DO UPDATE SET position_name=EXCLUDED.position_name,dashboard_key=EXCLUDED.dashboard_key RETURNING id,position_code AS \"positionCode\",position_name AS \"positionName\",dashboard_key AS \"dashboardKey\"",[org.id,code,name,key]);
  await db.query("INSERT INTO gis_organization_dashboards(organization_id,dashboard_key,position_code,config) VALUES($1,$2,$3,$4) ON CONFLICT(organization_id,dashboard_key,position_code) DO NOTHING",[org.id,key,code,JSON.stringify({organizationType:org.organizationType})]);
 }
 let assetCount=0,layerCount=0;
 for(const assetId of (Array.isArray(b.assetIds)?b.assetIds:[])){
  const a=String(assetId).trim(); if(!a)continue;
  const c=await db.query("INSERT INTO gis_organization_assets(organization_id,asset_id) VALUES($1,$2) ON CONFLICT(organization_id,asset_id) DO NOTHING",[org.id,a]); assetCount+=c.rowCount||0;
 }
 for(const layerId of (Array.isArray(b.layerIds)?b.layerIds:[])){
  const l=(await db.query("SELECT id FROM gis_layers WHERE id=$1 AND status='Active' AND verification_status='Verified'",[layerId])).rows[0]; if(!l)continue;
  const c=await db.query("INSERT INTO gis_organization_layer_entitlements(organization_id,layer_id,access_level,status) VALUES($1,$2,'VIEW','ACTIVE') ON CONFLICT(organization_id,layer_id) DO NOTHING",[org.id,layerId]); layerCount+=c.rowCount||0;
 }
 await db.query("INSERT INTO gis_organization_audit(organization_id,member_id,action,metadata) VALUES($1,$2,'ORGANIZATION_ONBOARDED',$3)",[org.id,req.member.id,JSON.stringify({phase:'388.7',assetAssignments:assetCount,layerEntitlements:layerCount})]);
 return res.status(201).json({phase:'388.7',organization:org,positionsProvisioned:DEFAULTS.length,dashboardsProvisioned:DEFAULTS.length,assetAssignments:assetCount,layerEntitlements:layerCount,workspaceReady:true,tenantIsolated:true,certificationUnaffected:true});
}