import { db } from 'hatchable';
export const access = 'member';
export const methods = ['GET'];
export default async function (_req, res) {
  const { rows } = await db.query(`
    SELECT a.id, a.asset_identifier AS "assetIdentifier", a.name, a.description, a.status,
           a.current_state AS "currentState", t.code AS "assetTypeId", t.name AS "assetTypeName",
           l.address AS location, l.latitude, l.longitude
    FROM assets a
    JOIN asset_types t ON t.id = a.asset_type_id
    LEFT JOIN asset_locations l ON l.asset_id = a.id AND l.is_primary = true
    ORDER BY a.created_at DESC
  `);
  res.json(rows);
}