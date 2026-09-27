import { db } from 'hatchable';
export const access='user';
export const methods=['GET'];
export default async function(req,res){
  const userId=String(req.user.id);
  const {rows}=await db.query(`
    SELECT o.id,o.name,o.slug,o.organization_type,o.status,o.dashboard_mode,
           m.role,m.status AS membership_status,
           p.position_code,p.position_name,p.dashboard_key
    FROM gis_organization_members m
    JOIN gis_organizations o ON o.id=m.organization_id
    LEFT JOIN gis_organization_positions p
      ON p.organization_id=o.id
     AND p.position_code=CASE WHEN m.role='ADMIN' THEN 'CEO' ELSE p.position_code END
    WHERE m.member_id=$1 AND m.status='ACTIVE' AND o.status='ACTIVE'
    ORDER BY o.created_at ASC`,[userId]);
  const organizations=rows.map(r=>({
    id:r.id,name:r.name,slug:r.slug||null,organizationType:r.organization_type||null,status:r.status,
    dashboardMode:r.dashboard_mode||r.dashboard_key||null,role:r.role||null,
    positionCode:r.position_code||null,positionTitle:r.position_name||null,dashboardKey:r.dashboard_key||null
  }));
  res.json({organizations});
}