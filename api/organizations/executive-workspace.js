import { db } from 'hatchable';
export const access='member';
export const methods=['GET'];

export default async function(req,res){
  const member=req.member;
  const organizationId=req.query?.organization_id;
  if(!organizationId) return res.status(400).json({error:'organization_id is required'});

  const org=(await db.query("SELECT o.id,o.name,o.organization_type,o.status,m.role FROM gis_organizations o JOIN gis_organization_members m ON m.organization_id=o.id WHERE o.id=$1 AND m.member_id=$2 AND m.status='ACTIVE'",[organizationId,member.id])).rows[0];
  if(!org) return res.status(404).json({error:'workspace_not_found'});

  const dashboards=(await db.query("SELECT id,dashboard_key,position_code,config FROM gis_organization_dashboards WHERE organization_id=$1 ORDER BY dashboard_key,position_code",[organizationId])).rows;
  const assets=(await db.query("SELECT asset_id,access_level FROM gis_organization_assets WHERE organization_id=$1 ORDER BY asset_id",[organizationId])).rows;
  const modules=(await db.query("SELECT dashboard_key,module_key,enabled,config FROM gis_organization_dashboard_modules WHERE organization_id=$1 AND enabled=true ORDER BY dashboard_key,module_key",[organizationId])).rows;
  const layers=(await db.query("SELECT layer_id,access_level,status FROM gis_organization_layer_entitlements WHERE organization_id=$1 AND status='ACTIVE'",[organizationId])).rows;

  res.json({
    phase:'388.9',
    organization:org,
    executiveWorkspace:{
      dashboardKey:'executive',
      kpis:{authorizedAssets:assets.length,authorizedLayers:layers.length,configuredDashboards:dashboards.length,enabledModules:modules.length},
      assets,
      layers,
      dashboards,
      modules,
      sections:['Strategic Overview','Portfolio','Risk Posture','Critical Alerts','GIS Intelligence','Recommendations','Reports'],
      dataPolicy:{tenantScoped:true,syntheticData:false,certificationIndependent:true}
    }
  });
}