import { db } from 'hatchable';
import { authorizeTenant, tenantError } from 'lib/tenantAuthority.js';
export const access='member';
export const methods=['GET'];
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export default async function(req,res){
 const projectId=String(req.params?.id||'').trim();
 if(!UUID.test(projectId))return res.status(404).json({error:'Project not found'});
 const p=await db.query('SELECT id,organization_id AS "organizationId" FROM projects WHERE id=$1',[projectId]);
 if(!p.rows.length)return res.status(404).json({error:'Project not found'});
 if(!p.rows[0].organizationId)return res.status(403).json({error:'project_not_tenant_assigned'});
 const tenant=await authorizeTenant(req,p.rows[0].organizationId,'capital:read');
 if(!tenant.allowed)return tenantError(res,tenant);
 const r=await db.query('SELECT e.id,e.submission_id AS "submissionId",e.event_type AS "eventType",e.actor,e.details,e.created_at AS "createdAt" FROM submission_events e JOIN institutional_submissions s ON s.id=e.submission_id WHERE s.project_id=$1 ORDER BY e.created_at DESC',[projectId]);
 res.json(r.rows);
}