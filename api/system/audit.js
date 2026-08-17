import { db } from 'hatchable';
export const access='admin';
export const methods=['GET'];
export default async function(req,res){const limit=Math.min(Number(req.query.limit||50),200);const r=await db.query('SELECT id,entity_type AS "entityType",entity_id AS "entityId",from_state AS "fromState",to_state AS "toState",actor,reason,metadata,created_at AS "createdAt" FROM canonical_lifecycle_events ORDER BY created_at DESC LIMIT $1',[limit]);res.json(r.rows);}