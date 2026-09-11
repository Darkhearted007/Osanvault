import { db } from 'hatchable';
import { authorizeTenant, tenantError } from 'lib/tenantAuthority.js';
export const access = 'admin'; export const methods = ['POST'];
export default async function(req,res){
 const id=String(req.params?.id||'').trim();
 const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
 if(!UUID.test(id))return res.status(404).json({error:'Project not found'});
 const p=await db.query('SELECT id,organization_id AS "organizationId" FROM projects WHERE id=$1',[id]);
 if(!p.rows.length)return res.status(404).json({error:'Project not found'});
 if(!p.rows[0].organizationId)return res.status(403).json({error:'project_not_tenant_assigned'});
 const tenant=await authorizeTenant(req,p.rows[0].organizationId,'capital:write');
 if(!tenant.allowed)return tenantError(res,tenant);
 const c=await db.query(`SELECT EXISTS(SELECT 1 FROM project_structures WHERE project_id=$1 AND status IN ('proposed','active')) AS legal_ready, EXISTS(SELECT 1 FROM project_assets pa JOIN assets a ON a.id=pa.asset_id WHERE pa.project_id=$1 AND a.status IN ('verified','institutionally_verified')) AS evidence_ready, EXISTS(SELECT 1 FROM project_assets pa JOIN asset_valuations v ON v.asset_id=pa.asset_id WHERE pa.project_id=$1) AS valuation_ready, EXISTS(SELECT 1 FROM project_assets pa JOIN asset_risk_assessments r ON r.asset_id=pa.asset_id WHERE pa.project_id=$1) AS risk_ready, EXISTS(SELECT 1 FROM opportunity_assessments o WHERE o.project_id=$1 AND o.status IN ('approved','capital_ready')) AS economics_ready`,[id]);
 const x=c.rows[0],governanceReady=false;
 const state=[x.legal_ready,x.evidence_ready,x.valuation_ready,x.risk_ready,x.economics_ready,governanceReady].every(Boolean)?'capital_ready':[x.legal_ready,x.evidence_ready,x.valuation_ready,x.risk_ready,x.economics_ready].some(Boolean)?'due_diligence_ready':'not_ready';
 const r=await db.query(`INSERT INTO project_capital_readiness(project_id,legal_ready,evidence_ready,valuation_ready,risk_ready,economics_ready,governance_ready,readiness_state,capital_requirement,currency,assessed_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,COALESCE((SELECT capital_requirement FROM opportunity_assessments WHERE project_id=$1 ORDER BY created_at DESC LIMIT 1),0),'NGN',now()) ON CONFLICT(project_id) DO UPDATE SET legal_ready=EXCLUDED.legal_ready,evidence_ready=EXCLUDED.evidence_ready,valuation_ready=EXCLUDED.valuation_ready,risk_ready=EXCLUDED.risk_ready,economics_ready=EXCLUDED.economics_ready,governance_ready=EXCLUDED.governance_ready,readiness_state=EXCLUDED.readiness_state,capital_requirement=EXCLUDED.capital_requirement,assessed_at=now() RETURNING id,readiness_state AS "readinessState"`,[id,x.legal_ready,x.evidence_ready,x.valuation_ready,x.risk_ready,x.economics_ready,governanceReady,state]);
 await db.query('INSERT INTO gis_organization_audit(organization_id,member_id,action,metadata) VALUES($1,$2,$3,$4)',[tenant.organization_id,req.member.id,'CAPITAL_READINESS_RECALCULATED',JSON.stringify({project_id:id,readiness_id:r.rows[0].id})]).catch(()=>{});
 res.json(r.rows[0]);
}