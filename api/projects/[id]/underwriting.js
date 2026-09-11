import { db } from 'hatchable';
import { authorizeTenant, tenantError } from '../../../lib/tenantAuthority.js';
export const access='member'; export const methods=['GET','POST'];
export default async function(req,res){
 const id=String(req.params?.id||'').trim();
 const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
 if(!UUID.test(id))return res.status(404).json({error:'Project not found'});
 const owner=await db.query('SELECT organization_id AS "organizationId" FROM projects WHERE id=$1',[id]);
 if(!owner.rows.length)return res.status(404).json({error:'Project not found'});
 if(!owner.rows[0].organizationId)return res.status(403).json({error:'project_not_tenant_assigned'});
 const tenant=await authorizeTenant(req,owner.rows[0].organizationId,req.method==='GET'?'capital:read':'capital:write');
 if(!tenant.allowed)return tenantError(res,tenant);
 if(req.method==='GET'){
  const r=await db.query('SELECT id,economic_score AS "economicScore",legal_score AS "legalScore",evidence_score AS "evidenceScore",valuation_score AS "valuationScore",risk_score AS "riskScore",governance_score AS "governanceScore",overall_score AS "overallScore",status,strengths,weaknesses,required_actions AS "requiredActions",model_version AS "modelVersion",assessed_at AS "assessedAt" FROM project_underwriting_assessments WHERE project_id=$1 ORDER BY assessed_at DESC LIMIT 1',[id]);
  return res.json(r.rows[0]||null);
 }
 const[econ,asset,vr]=await Promise.all([
  db.query('SELECT id,projected_revenue AS revenue,(acquisition_cost+legal_cost+development_cost+infrastructure_cost+operating_cost+financing_cost+contingency) AS cost FROM project_economic_models WHERE project_id=$1 ORDER BY created_at DESC LIMIT 1',[id]),
  db.query("SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE a.status IN ('verified','institutionally_verified'))::int AS verified FROM project_assets pa JOIN assets a ON a.id=pa.asset_id WHERE pa.project_id=$1",[id]),
  db.query('SELECT COUNT(*)::int AS total FROM asset_risk_assessments r JOIN project_assets pa ON pa.asset_id=r.asset_id WHERE pa.project_id=$1',[id])
 ]);
 const e=econ.rows[0],evidenceScore=asset.rows[0]?.total?Math.min(100,Number(asset.rows[0].verified)/Number(asset.rows[0].total)*100):0,economicScore=e&&Number(e.cost)>0?Math.max(0,Math.min(100,Number(e.revenue)/Number(e.cost)*50)):0,riskScore=vr.rows[0]?.total?70:0;
 const overall=Math.round(evidenceScore*.25+economicScore*.35+riskScore*.2+50*.2);
 const status=overall>=80?'capital_ready':overall>=60?'due_diligence_ready':'not_ready';
 const weaknesses=[],actions=[]; if(!e){weaknesses.push('No economic model');actions.push('Build project economic model')} if(evidenceScore<100){weaknesses.push('Asset verification incomplete');actions.push('Complete asset verification')} if(!vr.rows[0]?.total){weaknesses.push('No risk assessment');actions.push('Complete risk assessment')}
 const r=await db.query('INSERT INTO project_underwriting_assessments(project_id,economic_score,evidence_score,risk_score,overall_score,status,strengths,weaknesses,required_actions) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id,overall_score AS "overallScore",status,strengths,weaknesses,required_actions AS "requiredActions"',[id,economicScore,evidenceScore,riskScore,overall,status,JSON.stringify(overall>=60?['Project has a defined assessment pathway']:[]),JSON.stringify(weaknesses),JSON.stringify(actions)]);
 await db.query('INSERT INTO gis_organization_audit(organization_id,member_id,action,metadata) VALUES($1,$2,$3,$4)',[tenant.organization_id,req.member.id,'UNDERWRITING_ASSESSMENT_CREATED',JSON.stringify({project_id:id,underwriting_id:r.rows[0].id})]).catch(()=>{});
 res.status(201).json(r.rows[0]);
}