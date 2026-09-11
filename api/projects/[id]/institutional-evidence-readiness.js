import { db } from 'hatchable';
import { authorizeTenant, tenantError } from '../../../lib/tenantAuthority.js';
export const access='member'; export const methods=['GET'];
export default async function(req,res){
 const id=req.params.id,sourceId=req.query?.sourceId;
 const project=await db.query('SELECT id,organization_id AS "organizationId" FROM projects WHERE id=$1',[id]);
 if(!project.rows.length)return res.status(404).json({error:'Project not found'});
 if(!project.rows[0].organizationId)return res.status(403).json({error:'project_not_tenant_assigned'});
 const tenant=await authorizeTenant(req,project.rows[0].organizationId,'capital:read');
 if(!tenant.allowed)return tenantError(res,tenant);
 const params=sourceId?[id,sourceId]:[id];
 const sql=sourceId?'SELECT r.id AS requirement_id,r.requirement_code,r.title,r.category,r.required,r.evidence_type,r.source_id,o.organization_name,b.evidence_id,b.status,b.confidence,b.notes FROM institutional_source_requirements r JOIN institutional_profiles o ON o.id=r.source_id AND o.status=\'active\' LEFT JOIN requirement_evidence_bindings b ON b.requirement_id=r.id AND b.project_id=$1 WHERE r.source_id=$2 ORDER BY r.weight DESC,r.title':'SELECT r.id AS requirement_id,r.requirement_code,r.title,r.category,r.required,r.evidence_type,r.source_id,o.organization_name,b.evidence_id,b.status,b.confidence,b.notes FROM institutional_source_requirements r JOIN institutional_profiles o ON o.id=r.source_id AND o.status=\'active\' LEFT JOIN requirement_evidence_bindings b ON b.requirement_id=r.id AND b.project_id=$1 ORDER BY o.organization_name,r.weight DESC,r.title';
 const rows=await db.query(sql,params);
 const items=rows.rows.map(x=>{const fulfilled=['verified','accepted'].includes(x.status);return {sourceId:x.source_id,organizationName:x.organization_name,requirementId:x.requirement_id,code:x.requirement_code,title:x.title,category:x.category,required:x.required,evidenceType:x.evidence_type,evidenceId:x.evidence_id,status:x.status||'missing',confidence:x.confidence,fulfilled,notes:x.notes}});
 const groups=[...new Set(items.map(x=>x.sourceId))].map(s=>{const g=items.filter(x=>x.sourceId===s),required=g.filter(x=>x.required),satisfied=required.filter(x=>x.fulfilled);return {sourceId:s,organizationName:g[0]?.organizationName,requiredCount:required.length,satisfiedCount:satisfied.length,readinessScore:required.length?Math.round(satisfied.length/required.length*100):0}});
 res.json({projectId:id,sourceId:sourceId||null,sources:groups,items,disclaimer:'Evidence readiness is an internal screening signal; verification remains subject to applicable review procedures.'});
}