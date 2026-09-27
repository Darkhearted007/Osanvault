import { db } from 'hatchable';
import { authorizeTenant, tenantError } from 'lib/tenantAuthority.js';
export const access='member'; export const methods=['GET'];
export default async function(req,res){
 const q=await db.query('SELECT d.id,d.asset_id AS "assetId",d.institution_id AS "institutionId",d.name,d.status,d.created_at AS "createdAt",oa.organization_id AS "organizationId" FROM institutional_data_rooms d JOIN gis_organization_assets oa ON oa.asset_id=d.asset_id WHERE d.id=$1',[req.params.id]);
 if(!q.rows.length)return res.status(404).json({error:'Data room not found'});
 const tenant=await authorizeTenant(req,q.rows[0].organizationId,'capital:read'); if(!tenant.allowed)return tenantError(res,tenant);
 const r=q.rows[0];
 const [requests,questions,audit]=await Promise.all([
  db.query('SELECT id,request_type AS "requestType",title,description,required_evidence AS "requiredEvidence",status,priority,requested_by AS "requestedBy",resolved_at AS "resolvedAt",created_at AS "createdAt" FROM data_room_requests WHERE room_id=$1 ORDER BY created_at DESC',[r.id]),
  db.query('SELECT id,question,answer,status,asked_by AS "askedBy",answered_by AS "answeredBy",answered_at AS "answeredAt",created_at AS "createdAt" FROM data_room_questions WHERE room_id=$1 ORDER BY created_at DESC',[r.id]),
  db.query('SELECT id,action,actor_id AS "actorId",metadata,created_at AS "createdAt" FROM data_room_audit WHERE room_id=$1 ORDER BY created_at DESC LIMIT 100',[r.id])
 ]);
 res.json({room:r,requests:requests.rows,questions:questions.rows,audit:audit.rows});
}