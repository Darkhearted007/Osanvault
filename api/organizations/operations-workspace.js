import { db } from 'hatchable';
export const access='member';
export const methods=['GET'];
export default async function(req,res){
 const member=req.member, orgId=req.query?.organization_id;
 if(!orgId)return res.status(400).json({error:'organization_id is required'});
 const org=(await db.query("SELECT o.id,o.name,o.organization_type,m.role FROM gis_organizations o JOIN gis_organization_members m ON m.organization_id=o.id WHERE o.id=$1 AND m.member_id=$2 AND m.status='ACTIVE'",[orgId,member.id])).rows[0];
 if(!org)return res.status(404).json({error:'workspace_not_found'});
 const assets=(await db.query("SELECT id,asset_id,access_level FROM gis_organization_assets WHERE organization_id=$1 ORDER BY asset_id",[orgId])).rows;
 const dashboards=(await db.query("SELECT id,dashboard_key,position_code,config FROM gis_organization_dashboards WHERE organization_id=$1 ORDER BY dashboard_key,position_code",[orgId])).rows;
 const audit=(await db.query("SELECT action,metadata,created_at FROM gis_organization_audit WHERE organization_id=$1 ORDER BY created_at DESC LIMIT 20",[orgId])).rows;
 res.json({phase:'388.10',organization:org,operations:{assets,assetCount:assets.length,dashboards,priorityModules:['asset_operations','alerts','risk','gis','evidence','actions','reports'],recentAudit:audit},tenantIsolation:true});
}