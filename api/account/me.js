import { db } from 'hatchable';
export const access = 'user';
export const methods = ['GET'];

export default async function (req, res) {
  const user = req.user;
  const roleResult = await db.query('SELECT role FROM app_user_roles WHERE user_id = $1', [user.id]);
  const membershipResult = await db.query(`
    SELECT o.id AS organization_id,o.name AS organization_name,o.slug,o.status,
           m.role,m.status AS membership_status,p.position_code,p.position_name,p.dashboard_key
    FROM gis_organization_members m
    JOIN gis_organizations o ON o.id=m.organization_id
    LEFT JOIN gis_organization_positions p
      ON p.organization_id=o.id AND p.position_code='CEO' AND p.status='ACTIVE'
    WHERE m.member_id=$1 AND m.status='ACTIVE' AND o.status='ACTIVE'
    ORDER BY o.created_at ASC`, [user.id]);

  const founder = String(user.email || '').trim().toLowerCase() === 'olugbenga1000@gmail.com';
  const org = membershipResult.rows[0] || null;
  const founderReconciliation = founder
    ? (org
      ? {
          status:'VERIFIED', organization_id:org.organization_id, organization_name:org.organization_name,
          member_id:user.id, role:org.role, position_code:org.position_code||null,
          position_title:org.position_name||null, dashboard_key:org.dashboard_key||null
        }
      : {status:'NOT_PROVISIONED', reason:'FOUNDER_HAS_NO_ACTIVE_ORGANIZATION_MEMBERSHIP'})
    : {status:'NOT_APPLICABLE'};

  res.json({
    user,
    role: roleResult.rows[0]?.role || 'viewer',
    organization: org ? {
      id:org.organization_id,name:org.organization_name,slug:org.slug||null,status:org.status,
      role:org.role,positionCode:org.position_code||null,positionTitle:org.position_name||null,dashboardKey:org.dashboard_key||null
    } : null,
    founderReconciliation
  });
}