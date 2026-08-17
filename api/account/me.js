import { auth, db } from 'hatchable';
export const access = 'user';
export const methods = ['GET'];
export default async function (req, res) {
  const role = await db.query('SELECT role FROM app_user_roles WHERE user_id = $1', [req.user.id]);
  res.json({ user: req.user, role: role.rows[0]?.role || 'viewer' });
}