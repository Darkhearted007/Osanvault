import { db } from 'hatchable';
export const access = 'admin';
export const methods = ['GET', 'POST'];
export default async function (req, res) {
  if (req.method === 'GET') {
    const { rows } = await db.query('SELECT user_id AS "userId", role, created_at AS "createdAt", updated_at AS "updatedAt" FROM app_user_roles ORDER BY created_at DESC');
    return res.json(rows);
  }
  const { userId, role } = req.body || {};
  const allowed = ['viewer','contributor','verifier','operator','institution'];
  if (!userId || !allowed.includes(role)) return res.status(400).json({ error: 'userId and valid role are required', allowed });
  const { rows } = await db.query('INSERT INTO app_user_roles (user_id, role) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role, updated_at = now() RETURNING user_id AS "userId", role', [userId, role]);
  res.json(rows[0]);
}