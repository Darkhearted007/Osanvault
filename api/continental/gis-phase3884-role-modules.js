import { db } from 'hatchable';
export const access='member';
export const methods=['GET'];
const ROLE_MODULES={
 EXECUTIVE:['strategic_kpis','risk_posture','critical_alerts','investment_readiness','recommendations'],
 OPERATIONS:['asset_operations','priority_alerts','operational_risk','gis_assets','actions'],
 ANALYST:['evidence_explorer','intelligence_signals','gis_analysis','relationships','trends'],
 REGULATOR:['compliance','evidence','jurisdiction','audit_trail','review_queue'],
 INVESTOR:['portfolio','asset_readiness','risk','capital_opportunities','evidence_confidence']
};
export default async function(req,res){
 const member=req.member, orgId=req.query?.organization_id, dashboard=(req.query?.dashboard||'EXECUTIVE').toUpperCase();
 if(!orgId)return res.status(400).json({error:'organization_id is required'});
 const org=(await db.query("SELECT o.id,o.name,o.organization_type,m.role FROM gis_organizations o JOIN gis_organization_members m ON m.organization_id=o.id WHERE o.id=$1 AND m.member_id=$2 AND m.status='ACTIVE'",[orgId,member.id])).rows[0];
 if(!org)return res.status(404).json({error:'workspace_not_found'});
 const allowed=ROLE_MODULES[dashboard]||ROLE_MODULES.EXECUTIVE;
 const configured=(await db.query("SELECT module_key,enabled,config FROM gis_organization_dashboard_modules WHERE organization_id=$1 AND dashboard_key=$2 AND enabled=true ORDER BY module_key",[orgId,dashboard])).rows;
 const modules=allowed.map(k=>{const c=configured.find(x=>x.module_key===k);return {key:k,enabled:c?c.enabled:true,config:c?.config||{}}});
 const assetCount=(await db.query("SELECT COUNT(*)::int n FROM gis_organization_assets WHERE organization_id=$1",[orgId])).rows[0].n;
 const auditCount=(await db.query("SELECT COUNT(*)::int n FROM gis_organization_audit WHERE organization_id=$1",[orgId])).rows[0].n;
 const openReviews=(await db.query("SELECT COUNT(*)::int n FROM gis_phase3865_review_queue WHERE status='OPEN'")).rows[0].n;
 res.json({phase:'388.4',organization:org,dashboard:dashboard,modules,liveMetrics:{authorizedAssets:assetCount,auditEvents:auditCount,platformOpenReviews:openReviews},security:{tenantScoped:true,memberScoped:true,certificationUnaffected:true}});
}