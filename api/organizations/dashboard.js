import { db } from 'hatchable';
export const access='member';
export const methods=['GET'];
export default async function(req,res){
 const orgId=req.query?.organizationId;
 if(!orgId)return res.status(400).json({error:'organizationId is required'});
 const positionCode=req.query?.positionCode||null;
 const tx=await db.transaction([
  {sql:"SELECT set_config('app.current_member_id',$1,true)",params:[req.member.id]},
  {sql:"SELECT o.id,o.name,o.slug,o.organization_type AS \"organizationType\",m.role FROM gis_organization_members m JOIN gis_organizations o ON o.id=m.organization_id WHERE o.id=$1 AND m.member_id=$2 AND m.status='ACTIVE'",params:[orgId,req.member.id]},
  {sql:"SELECT dashboard_key AS \"dashboardKey\",position_code AS \"positionCode\",config FROM gis_organization_dashboards WHERE organization_id=$1 AND (position_code=$2 OR position_code IS NULL) ORDER BY position_code NULLS LAST",params:[orgId,positionCode]},
  {sql:"SELECT asset_id AS \"assetId\",access_level AS \"accessLevel\" FROM gis_organization_assets WHERE organization_id=$1 ORDER BY asset_id",params:[orgId]}
 ]);
 if(!tx.results[1].rows.length)return res.status(403).json({error:'Organization access denied'});
 return res.json({organization:tx.results[1].rows[0],dashboards:tx.results[2].rows,assets:tx.results[3].rows,positionCode,tenantIsolated:true});
}