import { db } from 'hatchable';
export const access='user';
export const methods=['GET'];
export default async function(req,res){
 const member=req.user, orgId=req.query?.organization_id, dashboard=req.query?.dashboard;
 if(!orgId||!dashboard)return res.status(400).json({error:'organization_id and dashboard are required'});
 const org=(await db.query("SELECT o.id,o.name,o.organization_type,m.role FROM gis_organization_members m JOIN gis_organizations o ON o.id=m.organization_id WHERE o.id=$1 AND m.member_id=$2 AND m.status='ACTIVE'",[orgId,member.id])).rows[0];
 if(!org)return res.status(404).json({error:'workspace_not_found'});
 const positions=(await db.query("SELECT id,title,dashboard_key FROM gis_organization_positions WHERE organization_id=$1 AND dashboard_key=$2 ORDER BY title",[orgId,dashboard])).rows;
 const assets=(await db.query("SELECT COUNT(*)::int total FROM gis_organization_assets WHERE organization_id=$1",[orgId])).rows[0].total;
 const openExceptions=(await db.query("SELECT COUNT(*)::int total FROM gis_phase3865_review_queue WHERE status='OPEN'")).rows[0].total;
 const publishedLayers=(await db.query("SELECT COUNT(*)::int total FROM gis_layers gl JOIN gis_layer_publication_rules r ON r.layer_id=gl.id WHERE gl.status='Active' AND gl.verification_status='Verified' AND r.publication_status='Published'")).rows[0].total;
 const gisFeatures=(await db.query("SELECT COUNT(*)::int total FROM gis_spatial_features sf JOIN gis_organization_assets oa ON oa.asset_id=sf.id WHERE oa.organization_id=$1",[orgId])).rows[0].total;
 const recommendations=(await db.query("SELECT COUNT(*)::int total FROM gis_asset_decision_snapshots ds JOIN gis_organization_assets oa ON oa.asset_id=ds.asset_id WHERE oa.organization_id=$1 AND ds.investment_impact IN ('CONDITIONAL','BLOCKING')",[orgId])).rows[0].total;
 const metrics={authorizedAssets:assets,positionCount:positions.length,authorizedGisFeatures:gisFeatures,publishedIntelligenceLayers:publishedLayers,activeReviewExceptions:openExceptions,decisionFlags:recommendations};
 res.json({phase:388.3,organization:org,dashboard:{key:dashboard,positions,metrics,modules:['overview','assets','risk','alerts','gis','reports']},tenantIsolation:{enforced:true,memberId:member.id},dataStatus:assets?'LIVE_TENANT_DATA':'NO_ORGANIZATION_ASSETS_ASSIGNED',certification:{enabled:false,reason:'GIS certification gate remains independent and blocked by unresolved exceptions'}});
}