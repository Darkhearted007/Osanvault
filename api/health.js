import { db } from 'hatchable';
export const access = 'public';
export const methods = ['GET'];
export default async function (_req, res) {
  try {
    await db.query('SELECT 1');
    res.json({ status: 'ok', service: 'osanvault', time: new Date().toISOString() });
  } catch (error) {
    console.error(error);
    res.status(503).json({ status: 'error', service: 'osanvault' });
  }
}