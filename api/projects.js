import { db } from 'hatchable';
export const access = 'member';
export const methods = ['GET'];
export default async function(req,res){const r=await db.query(`SELECT p.id,p.project_identifier AS "projectIdentifier",p.name,p.description,p.project_type AS "projectType",p.status,p.jurisdiction,COUNT(pa.asset_id)::int AS "assetCount" FROM projects p LEFT JOIN project_assets pa ON pa.project_id=p.id GROUP BY p.id ORDER BY p.created_at DESC`);res.json(r.rows);}