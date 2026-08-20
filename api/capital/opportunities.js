import { db } from 'hatchable';
export const access = 'member';
export const methods = ['GET'];
export default async function(req,res){const r=await db.query(`SELECT co.id,co.project_id AS "projectId",p.name AS "projectName",co.status,co.eligibility_score AS "eligibilityScore",co.eligibility_state AS "eligibilityState",co.summary FROM capital_opportunities co JOIN projects p ON p.id=co.project_id WHERE co.status IN ('diligence','open') ORDER BY co.updated_at DESC`);res.json(r.rows)}