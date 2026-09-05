import { db } from 'hatchable';
export const access='user';
export const methods=['GET'];
export default async function(req,res){
  const orgId=String(req.query?.organizationId||'');
  if(!orgId)return res.status(400).json({error:'organizationId is required'});
  const userId=String(req.user.id);
  const org=await db.query(`SELECT id,name,slug,organization_type,status,dashboard_mode FROM gis_organizations WHERE id=$1 AND status='ACTIVE'`,[orgId]);
  if(!org.rows[0])return res.status(404).json({error:'Organization not found'});
  const membership=await db.query(`SELECT id,member_id,role,status FROM gis_organization_members WHERE organization_id=$1 AND member_id=$2 AND status='ACTIVE'`,[orgId,userId]);
  if(!membership.rows[0])return res.status(403).json({error:'Organization access denied'});
  const role=membership.rows[0].role||'USER';
  const positionCode=role==='ADMIN'?'CEO':null;
  const position=positionCode?await db.query(`SELECT position_code,position_name,dashboard_key FROM gis_organization_positions WHERE organization_id=$1 AND position_code=$2 AND status='ACTIVE'`,[orgId,positionCode]):{rows:[]};
  const requestedPosition=req.query?.positionCode||null;
  if(requestedPosition&&requestedPosition!==positionCode)return res.status(403).json({error:'Position access denied'});
  const dashboards=await db.query(`SELECT id,dashboard_key,position_code,config FROM gis_organization_dashboards WHERE organization_id=$1 AND position_code=$2`,[orgId,positionCode||'__none__']);
  const assets=await db.query(`SELECT ga.asset_id,ga.access_level,a.name,a.status,a.asset_identifier FROM gis_organization_assets ga JOIN assets a ON a.id=ga.asset_id WHERE ga.organization_id=$1`,[orgId]);
  res.json({
    phase:'production-organization-dashboard',
    organization:{id:org.rows[0].id,name:org.rows[0].name,slug:org.rows[0].slug||null,organizationType:org.rows[0].organization_type,status:org.rows[0].status,role,positionCode:position.rows[0]?.position_code||null,positionTitle:position.rows[0]?.position_name||null,dashboardKey:position.rows[0]?.dashboard_key||null},
    dashboards:dashboards.rows,
    assets:assets.rows.map(a=>({assetId:a.asset_id,accessLevel:a.access_level,name:a.name,status:a.status,assetIdentifier:a.asset_identifier})),
    positionCode,
    intelligence:{assets:[],risk:[],alerts:[],reports:[]},
    modules:['overview','assets','risk','alerts','gis','reports','recommendations'],
    tenantIsolated:true
  });
}