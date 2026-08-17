import { db } from 'hatchable';
export const access = 'public';
export const methods = ['GET'];
export default async function(req,res){const r=await db.query('SELECT code,name,category,description,requires_rights_evidence AS "requiresRightsEvidence" FROM asset_taxonomy WHERE active=true ORDER BY category,name');res.json(r.rows)}