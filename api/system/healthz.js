import { db } from 'hatchable';
export const access = 'public';
export const methods = ['GET'];

export default async function(req,res) {
  res.setHeader('Cache-Control','no-store');
  try {
    await db.query('SELECT 1');
    return res.json({status:'ok',service:'osanvault',version:'OV-15.9'});
  } catch (error) {
    return res.status(503).json({status:'degraded',service:'osanvault'});
  }
}
