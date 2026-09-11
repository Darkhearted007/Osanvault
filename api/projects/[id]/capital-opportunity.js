import { db } from 'hatchable';
import { authorizeTenant, tenantError } from 'lib/tenantAuthority.js';
export const access='admin';
export const methods=['POST'];
export default async function(req,res){
 const id=String(req.params?.id||'').trim();
 const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
 if(!UUID.test(id))return res.status(404).json({error:'Project not found'});
 const gates=['legal','evidence','valuation','risk','economics','governance'];
 const p=await db.query('SELECT id,name,organization_id AS "organizationId" FROM projects WHERE id=$1',[id]);
 if(!p.rows.length)return res.status(404).json({error:'Project not found'});
 if(!p.rows[0].organizationId)return res.status(403).json({error:'project_not_tenant_assigned'});
 const tenant=await authorizeTenant(req,p.rows[0].organizationId,'capital:write');
 if(!tenant.allowed)return tenantError(res,tenant);
 const[readiness,economic,risk]=await Promise.all([
  db.query('SELECT * FROM project_readiness WHERE project_id=$1 ORDER BY created_at DESC LIMIT 1',[id]),
  db.query('SELECT * FROM project_economic_models WHERE project_id=$1 ORDER BY created_at DESC LIMIT 1',[id]),
  db.query('SELECT * FROM project_risk_assessments WHERE project_id=$1 ORDER BY created_at DESC LIMIT 1',[id])
 ]);
 let score=0;
 const evidence=await db.query('SELECT COUNT(*)::int AS n FROM project_evidence WHERE project_id=$1',[id]).catch(()=>({rows:[{n:0}]}));
 score+=readiness.rows.length?50:0; score+=economic.rows.length?20:0; score+=risk.rows.length?15:0; score+=evidence.rows[0].n?15:0;
 const state=score>=85?'capital_ready':score>=60?'diligence_ready':'not_ready';
 const r=await db.query('INSERT INTO capital_opportunities(project_id,eligibility_score,eligibility_state,status,summary) VALUES($1,$2,$3,$4,$5) RETURNING id,project_id AS "projectId",eligibility_score AS "eligibilityScore",eligibility_state AS "eligibilityState",status,summary',[id,score,state,state==='capital_ready'?'diligence':'draft',`Eligibility assessed from project readiness, economics, risk and evidence. ${gates.length} diligence gates remain governed separately.`]);
 for(const g of gates)await db.query('INSERT INTO transaction_diligence_gates(opportunity_id,gate_code,status) VALUES($1,$2,$3) ON CONFLICT(opportunity_id,gate_code) DO NOTHING',[r.rows[0].id,g,'pending']);
 await db.query('INSERT INTO gis_organization_audit(organization_id,member_id,action,metadata) VALUES($1,$2,$3,$4)',[tenant.organization_id,req.member.id,'CAPITAL_OPPORTUNITY_CREATED',JSON.stringify({project_id:id,opportunity_id:r.rows[0].id,eligibility_state:state})]).catch(()=>{});
 res.status(201).json({...r.rows[0],diligenceGates:gates,notice:'Capital opportunity assessment is an internal screening workflow. It is not financing approval, an investment recommendation, or a guarantee of funding.'});
}