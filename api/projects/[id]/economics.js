import { db } from 'hatchable';
import { authorizeTenant, tenantError } from '../../../lib/tenantAuthority.js';
export const access='member'; export const methods=['GET','POST'];
export default async function(req,res){
 const id=req.params.id;
 const owner=await db.query('SELECT organization_id AS "organizationId" FROM projects WHERE id=$1',[id]);
 if(!owner.rows.length)return res.status(404).json({error:'Project not found'});
 if(!owner.rows[0].organizationId)return res.status(403).json({error:'project_not_tenant_assigned'});
 const tenant=await authorizeTenant(req,owner.rows[0].organizationId,req.method==='GET'?'capital:read':'capital:write');
 if(!tenant.allowed)return tenantError(res,tenant);
 if(req.method==='GET'){
  const[m,s]=await Promise.all([
   db.query('SELECT id,currency,acquisition_cost AS "acquisitionCost",legal_cost AS "legalCost",development_cost AS "developmentCost",infrastructure_cost AS "infrastructureCost",operating_cost AS "operatingCost",financing_cost AS "financingCost",contingency,projected_revenue AS "projectedRevenue",development_months AS "developmentMonths",operating_months AS "operatingMonths",exit_value AS "exitValue",assumptions,status FROM project_economic_models WHERE project_id=$1 ORDER BY created_at DESC LIMIT 1',[id]),
   db.query('SELECT id,scenario_name AS "scenarioName",revenue_multiplier AS "revenueMultiplier",cost_multiplier AS "costMultiplier",exit_multiplier AS "exitMultiplier",projected_profit AS "projectedProfit",projected_margin AS "projectedMargin",assumptions FROM project_economic_scenarios s JOIN project_economic_models m ON m.id=s.economic_model_id WHERE m.project_id=$1 ORDER BY s.created_at DESC',[id])
  ]);
  return res.json({model:m.rows[0]||null,scenarios:s.rows});
 }
 const b=req.body||{}; if(b.projectId&&b.projectId!==id)return res.status(400).json({error:'project mismatch'});
 const n=['acquisitionCost','legalCost','developmentCost','infrastructureCost','operatingCost','financingCost','contingency','projectedRevenue','exitValue'];
 const v=Object.fromEntries(n.map(k=>[k,Number(b[k]||0)]));
 const total=v.acquisitionCost+v.legalCost+v.developmentCost+v.infrastructureCost+v.operatingCost+v.financingCost+v.contingency;
 const profit=v.projectedRevenue-total;
 const r=await db.query('INSERT INTO project_economic_models(project_id,currency,acquisition_cost,legal_cost,development_cost,infrastructure_cost,operating_cost,financing_cost,contingency,projected_revenue,development_months,operating_months,exit_value,assumptions,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING id',[id,b.currency||'NGN',v.acquisitionCost,v.legalCost,v.developmentCost,v.infrastructureCost,v.operatingCost,v.financingCost,v.contingency,v.projectedRevenue,b.developmentMonths||null,b.operatingMonths||null,v.exitValue,b.assumptions||{},'draft']);
 const modelId=r.rows[0].id;
 await db.query('INSERT INTO project_economic_scenarios(economic_model_id,scenario_name,revenue_multiplier,cost_multiplier,exit_multiplier,projected_profit,projected_margin) VALUES($1,$2,1,1,1,$3,$4)',[modelId,'Base Case',profit,total?profit/total:0]);
 await db.query('INSERT INTO gis_organization_audit(organization_id,member_id,action,metadata) VALUES($1,$2,$3,$4)',[tenant.organization_id,req.member.id,'ECONOMIC_MODEL_CREATED',JSON.stringify({project_id:id,economic_model_id:modelId})]).catch(()=>{});
 res.status(201).json({id:modelId,totalCost:total,projectedProfit:profit,projectedMargin:total?profit/total:0,notice:'All economic values are project projections/assumptions unless independently verified; this endpoint does not convert projections into actuals.'});
}