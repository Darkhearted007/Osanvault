import { db } from 'hatchable';
export const access='member';
export const methods=['GET'];
export default async function(req,res){
 const member=req.member;
 const organizationId=req.query?.organization_id;
 const dashboard=req.query?.dashboard;
 if(!organizationId||!dashboard) return res.status(400).json({error:'organization_id and dashboard are required'});
 const m=(await db.query("SELECT o.id,o.name,o.organization_type FROM gis_organizations o JOIN gis_organization_memberships m ON m.organization_id=o.id WHERE o.id=$1 AND m.member_id=$2",[organizationId,member.id])).rows[0];
 if(!m) return res.status(404).json({error:'workspace_not_found'});
 const p=(await db.query("SELECT id,title,dashboard_key FROM gis_organization_positions WHERE organization_id=$1 AND dashboard_key=$2",[organizationId,dashboard])).rows;
 res.json({phase:388,organization:m,dashboard:{key:dashboard,positions:p,modules:['overview','assets','risk','alerts','gis','reports'],tenant_isolation:true}});
}