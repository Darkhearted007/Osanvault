import { db } from 'hatchable';
export const access='member';
export const methods=['GET'];
export default async function(req,res){
 const orgId=req.query?.organizationId, positionCode=req.query?.positionCode;
 if(!orgId||!positionCode)return res.status(400).json({error:'organizationId and positionCode are required'});
 const membership=await db.query("SELECT o.name,m.role FROM gis_organization_members m JOIN gis_organizations o ON o.id=m.organization_id WHERE m.organization_id=$1 AND m.member_id=$2 AND m.status='ACTIVE'",[orgId,req.member.id]);
 if(!membership.rows.length)return res.status(403).json({error:'Organization access denied'});
 const dashboards=await db.query("SELECT dashboard_key AS \"dashboardKey\",config FROM gis_organization_dashboards WHERE organization_id=$1 AND position_code=$2",[orgId,positionCode]);
 return res.json({organization:membership.rows[0],position:{positionCode},dashboards:dashboards.rows,tenantIsolated:true});
}