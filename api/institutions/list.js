import { db } from 'hatchable';
export const access = 'admin';
export const methods = ['GET'];
export default async function(req,res){const r=await db.query('SELECT id,organization_name AS "organizationName",organization_type AS "organizationType",jurisdiction,website,mandate,status,created_at AS "createdAt" FROM institutional_profiles ORDER BY created_at DESC');res.json(r.rows)}