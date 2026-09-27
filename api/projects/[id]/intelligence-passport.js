import { db } from 'hatchable';
import { authorizeTenant, tenantError } from 'lib/tenantAuthority.js';
export const access='member';
export const methods=['GET'];
export default async function(req,res){
 const id=String(req.params?.id||'').trim();
 const p=await db.query('SELECT id,organization_id AS "organizationId",name,status,jurisdiction,development_stage AS "developmentStage" FROM projects WHERE id=$1',[id]);
 if(!p.rows.length)return res.status(404).json({error:'Project not found'});
 if(!p.rows[0].organizationId)return res.status(403).json({error:'project_not_tenant_assigned'});
 const tenant=await authorizeTenant(req,p.rows[0].organizationId,'capital:read');
 if(!tenant.allowed)return tenantError(res,tenant);
 const passport=await db.query('SELECT * FROM project_intelligence_passports WHERE project_id=$1',[id]);
 const readiness=await db.query('SELECT * FROM project_capital_readiness WHERE project_id=$1',[id]);
 const gaps=await db.query('SELECT id,domain,requirement_code,title,description,priority,blocking,status,evidence_required AS "evidenceRequired" FROM project_readiness_gaps WHERE project_id=$1 ORDER BY blocking DESC,priority DESC,created_at',[id]);
 const rem=await db.query("SELECT blocker_code AS \"blockerCode\",title,status,priority,required_evidence AS \"requiredEvidence\" FROM intelligence_remediation_items WHERE subject_type='project' AND subject_id=$1 ORDER BY priority DESC,created_at",[id]);
 return res.json({project:p.rows[0],passport:passport.rows[0]||null,readiness:readiness.rows[0]||null,gaps:gaps.rows,remediation:rem.rows});
}