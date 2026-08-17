import { db } from 'hatchable';
export const access = 'admin';
export const methods = ['GET'];
export default async function (req, res) {
  const { rows } = await db.query('SELECT id, event_type AS "eventType", actor, payload, created_at AS "createdAt" FROM asset_events WHERE asset_id = $1 ORDER BY created_at DESC LIMIT 100', [req.params.id]);
  res.json(rows);
}