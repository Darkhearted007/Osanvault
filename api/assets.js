import { db } from 'hatchable';
export const access = 'member';
export const methods = ['GET'];
export default async function (req, res) {
  if(!req.member?.id)return res.status(401).json({error:'authentication_required'});
  const { rows } = await db.query(`
    SELECT a.id, a.asset_identifier AS "assetIdentifier", a.name, a.description, a.status,
           a.current_state AS "currentState", t.code AS "assetTypeId", t.name AS "assetTypeName",
           l.address AS location, l.latitude, l.longitude
    FROM assets a
    JOIN asset_types t ON t.id = a.asset_type_id
    LEFT JOIN asset_locations l ON l.asset_id = a.id AND l.is_primary = true
    JOIN gis_organization_assets ga ON ga.asset_id=a.id
    JOIN gis_organization_members gm ON gm.organization_id=ga.organization_id AND gm.member_id=$1 AND gm.status='ACTIVE'
    ORDER BY a.created_at DESC
  `,[req.member.id]);
  res.json(rows);
}