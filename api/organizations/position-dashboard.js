import { db } from 'hatchable';
export const access='member';
export const methods=['GET'];
export default async function(req,res){
 const orgId=req.query?.organizationId, positionCode=req.query?.positionCode;
 if(!orgId||!positionCode)return res.status(400).json({error:'organizationId and positionCode are required'});
 const tx=await db.transaction([
  {sql:"SELECT set_config('app.current_member_id',$1,true)",params:[req.member.id]},
  {sql:"SELECT o.name,m.role FROM gis_organization_members m JOIN gis_organizations o ON o.id=m.organization_id WHERE m.organization_id=$1 AND m.member_id=$2 AND m.status='ACTIVE'",params:[orgId,req.member.id]},
  {sql:"SELECT dashboard_key AS \"dashboardKey\",config FROM gis_organization_dashboards WHERE organization_id=$1 AND position_code=$2",params:[orgId,positionCode]}
 ]);
 if(!tx.results[1].rows.length)return res.status(403).json({error:'Organization access denied'});
 return res.json({organization:tx.results[1].rows[0],position:{positionCode},dashboards:tx.results[2].rows,tenantIsolated:true});
}