import { db } from 'hatchable';
import { authorizeTenant, tenantError } from '../../../lib/tenantAuthority.js';
export const access='member'; export const methods=['GET'];
export default async function(req,res){
 const id=req.params.id;
 const project=await db.query('SELECT id,organization_id AS "organizationId" FROM projects WHERE id=$1',[id]);
 if(!project.rows.length)return res.status(404).json({error:'Project not found'});
 if(!project.rows[0].organizationId)return res.status(403).json({error:'project_not_tenant_assigned'});
 const tenant=await authorizeTenant(req,project.rows[0].organizationId,'capital:read');
 if(!tenant.allowed)return tenantError(res,tenant);
 const p=await db.query('SELECT id,capital_readiness_score,development_stage,use_of_funds,expected_cashflow,security_type,governance_notes FROM canonical_capital_profiles WHERE project_id=$1',[id]);
 if(!p.rows.length)return res.status(404).json({error:'capital_profile_not_found'});
 const s=p.rows[0];
 const src=await db.query("SELECT id,organization_name,organization_type,mandate FROM institutional_profiles WHERE status='active' ORDER BY organization_name");
 if(!src.rows.length)return res.json({projectId:id,assessments:[]});
 const reqs=await db.query("SELECT source_id,requirement_code,title,description,category,required,weight,evidence_type FROM institutional_source_requirements WHERE source_id IN (SELECT id FROM institutional_profiles WHERE status='active')");
 const by=new Map();for(const r of reqs.rows){if(!by.has(r.source_id))by.set(r.source_id,[]);by.get(r.source_id).push(r)}
 const assessments=src.rows.map(o=>{const rr=by.get(o.id)||[];const checks=rr.map(r=>{let ok=true;if(r.category==='readiness')ok=Number(s.capital_readiness_score||0)>=60;if(r.category==='cashflow')ok=Number(s.expected_cashflow||0)>0;if(r.category==='security')ok=!!s.security_type;if(r.category==='governance')ok=!!s.governance_notes;return {...r,satisfied:ok}});const required=checks.filter(x=>x.required);const satisfied=required.filter(x=>x.satisfied);const score=required.length?Math.round(satisfied.reduce((a,x)=>a+x.weight,0)/required.reduce((a,x)=>a+x.weight,0)*100):Math.min(100,Number(s.capital_readiness_score||0));const gaps=required.filter(x=>!x.satisfied).map(x=>({code:x.requirement_code,title:x.title,category:x.category,evidenceType:x.evidence_type}));const state=score>=85?'approach_ready':score>=60?'conditional':'not_ready';return {source:{id:o.id,organizationName:o.organization_name,organizationType:o.organization_type,mandate:o.mandate},readinessScore:score,eligibilityState:state,satisfiedCount:satisfied.length,requiredCount:required.length,gaps,actions:gaps.map(g=>`Complete ${g.title} before institutional submission.`)}});res.json({projectId:id,assessments,disclaimer:'Eligibility screening is an internal readiness signal, not a financing approval, legal opinion, investment recommendation, or guarantee.'});
}