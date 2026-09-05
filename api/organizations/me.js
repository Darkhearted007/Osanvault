import { db } from 'hatchable';
export const access='member';
export const methods=['GET'];
export default async function(req,res){
 const r=await db.query("SELECT o.id,o.name,o.slug,o.organization_type AS \"organizationType\",o.status,o.dashboard_mode AS \"dashboardMode\",m.role FROM gis_organization_members m JOIN gis_organizations o ON o.id=m.organization_id WHERE m.member_id=$1 AND m.status='ACTIVE' ORDER BY o.name",[req.member.id]);
 return res.json({organizations:r.rows});
}