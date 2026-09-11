import { db } from 'hatchable';
import { authorizeTenant, tenantError } from 'lib/tenantAuthority.js';
export const access='member';
export const methods=['GET'];
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export default async function(req,res){
 const id=String(req.params?.id||'').trim();
 if(!UUID.test(id))return res.status(404).json({error:'Opportunity not found'});
 const r=await db.query('SELECT co.id,co.project_id AS "projectId",p.organization_id AS "organizationId",p.name AS "projectName",co.status,co.eligibility_score AS "eligibilityScore",co.eligibility_state AS "eligibilityState",co.summary FROM capital_opportunities co JOIN projects p ON p.id=co.project_id WHERE co.id=$1',[id]);
 if(!r.rows.length)return res.status(404).json({error:'Opportunity not found'});
 const tenant=await authorizeTenant(req,r.rows[0].organizationId,'opportunity:read');
 if(!tenant.allowed)return tenantError(res,tenant);
 const g=await db.query('SELECT gate_code AS "gateCode",status,evidence_required AS "evidenceRequired",completed_at AS "completedAt" FROM transaction_diligence_gates WHERE opportunity_id=$1 ORDER BY gate_code',[id]);
 const t=await db.query('SELECT room_code AS "roomCode",status,access_policy AS "accessPolicy",opened_at AS "openedAt" FROM transaction_rooms WHERE opportunity_id=$1 ORDER BY opened_at DESC',[id]);
 res.json({...r.rows[0],diligenceGates:g.rows,transactionRooms:t.rows,notice:'Capital exchange is for structured diligence and non-binding engagement. It does not accept public funds or create an investment security.'});
}