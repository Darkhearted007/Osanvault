import { db } from 'hatchable';
import { authorizeTenant, tenantError } from 'lib/tenantAuthority.js';
export const access='member';
export const methods=['GET','POST','PUT'];
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const outcomes=['pending','interested','more_information','diligence','approved','approved_with_conditions','declined','withdrawn'];
export default async function(req,res){
 const projectId=String(req.params?.id||'').trim();
 if(!UUID.test(projectId))return res.status(404).json({error:'Project not found'});
 const p=await db.query('SELECT id,organization_id AS "organizationId" FROM projects WHERE id=$1',[projectId]);
 if(!p.rows.length)return res.status(404).json({error:'Project not found'});
 if(!p.rows[0].organizationId)return res.status(403).json({error:'project_not_tenant_assigned'});
 const permission=req.method==='GET'?'capital:read':'capital:write';
 const tenant=await authorizeTenant(req,p.rows[0].organizationId,permission);
 if(!tenant.allowed)return tenantError(res,tenant);
 if(req.method==='GET'){
  const submissions=await db.query('SELECT s.id AS "submissionId",s.status AS "submissionStatus",s.outcome,s.notes,s.decision_at AS "decisionAt",s.match_id AS "matchId" FROM institutional_submissions s WHERE s.project_id=$1 ORDER BY s.created_at DESC',[projectId]);
  const diligence=await db.query('SELECT id,institution_id AS "institutionId",status,findings,scope,completed_at AS "completedAt" FROM institutional_due_diligence WHERE project_id=$1 ORDER BY opened_at DESC',[projectId]);
  const remediation=await db.query("SELECT blocker_code AS \"blockerCode\",title,status,priority,required_evidence AS \"requiredEvidence\" FROM intelligence_remediation_items WHERE subject_id=$1 AND subject_type='project' ORDER BY priority DESC,created_at",[projectId]);
  const capital=await db.query('SELECT capital_readiness_score AS "capitalReadinessScore",development_stage,use_of_funds FROM canonical_capital_profiles WHERE project_id=$1',[projectId]);
  return res.json({projectId,submissions:submissions.rows,diligence:diligence.rows,openConditions:remediation.rows.filter(x=>x.status!=='completed'),capitalReadiness:capital.rows[0]||null});
 }
 const b=req.body||{};
 if(!b.submissionId||!UUID.test(String(b.submissionId)))return res.status(404).json({error:'Submission not found'});
 const s=await db.query('SELECT id FROM institutional_submissions WHERE id=$1 AND project_id=$2',[b.submissionId,projectId]);
 if(!s.rows.length)return res.status(404).json({error:'Submission not found'});
 if(req.method==='POST'){
  if(!outcomes.includes(b.outcome))return res.status(400).json({error:'valid outcome is required'});
  const r=await db.query("UPDATE institutional_submissions SET status='decided',outcome=$1,notes=COALESCE($2,notes),decision_at=now(),updated_at=now() WHERE id=$3 AND project_id=$4 RETURNING id,status,outcome,notes,decision_at AS \"decisionAt\"",[b.outcome,b.notes||null,b.submissionId,projectId]);
  let created=0;
  if(Array.isArray(b.conditions))for(const c of b.conditions){
   if(!c.code||!c.title)continue;
   await db.query("INSERT INTO intelligence_remediation_items(subject_type,subject_id,blocker_code,title,description,required_evidence,priority,created_by) VALUES('project',$1,$2,$3,$4,$5,$6,$7) ON CONFLICT(subject_type,subject_id,blocker_code) DO UPDATE SET title=EXCLUDED.title,description=EXCLUDED.description,required_evidence=EXCLUDED.required_evidence,priority=EXCLUDED.priority,updated_at=now()",[projectId,c.code,c.title,c.description||'Institutional decision condition',c.requiredEvidence||null,c.priority||'high',req.member.id]);
   created++;
  }
  await db.query('INSERT INTO gis_organization_audit(organization_id,member_id,action,metadata) VALUES($1,$2,$3,$4)',[tenant.organization_id,req.member.id,'INSTITUTIONAL_DECISION_RECONCILED',JSON.stringify({project_id:projectId,submission_id:b.submissionId,outcome:b.outcome})]).catch(()=>{});
  return res.status(201).json({decision:r.rows[0],conditionsCreated:created,reconcileNext:'Reassess intelligence, remediation and capital readiness after conditions are resolved.'});
 }
 const open=await db.query("SELECT count(*)::int AS count FROM intelligence_remediation_items WHERE subject_type='project' AND subject_id=$1 AND status<>'completed'",[projectId]);
 return res.json({projectId,submissionId:b.submissionId,openConditions:open.rows[0].count,readyToReassess:true});
}