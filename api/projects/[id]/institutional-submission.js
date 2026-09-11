import { db } from 'hatchable';
import { authorizeTenant, tenantError } from 'lib/tenantAuthority.js';
export const access='member'; export const methods=['GET','POST','PUT'];
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const statuses=['pending_authorization','authorized','pack_generated','submitted','received','under_review','questions','diligence','decided','withdrawn'];
export default async function(req,res){
 const id=String(req.params?.id||'').trim();
 if(!UUID.test(id))return res.status(404).json({error:'Project not found'});
 const p=await db.query('SELECT id,organization_id AS "organizationId" FROM projects WHERE id=$1',[id]);
 if(!p.rows.length)return res.status(404).json({error:'Project not found'});
 if(!p.rows[0].organizationId)return res.status(403).json({error:'project_not_tenant_assigned'});
 const tenant=await authorizeTenant(req,p.rows[0].organizationId,req.method==='GET'?'capital:read':'capital:write');
 if(!tenant.allowed)return tenantError(res,tenant);
 if(req.method==='GET'){
  const r=await db.query('SELECT s.id,s.project_id AS "projectId",s.match_id AS "matchId",s.status,s.authorized_at AS "authorizedAt",s.submitted_at AS "submittedAt",s.received_at AS "receivedAt",s.decision_at AS "decisionAt",s.outcome,s.notes,m.institution_id AS "institutionId",m.match_score AS "matchScore",m.match_state AS "matchState" FROM institutional_submissions s JOIN institutional_match_submissions m ON m.id=s.match_id WHERE s.project_id=$1 ORDER BY s.created_at DESC',[id]);
  return res.json(r.rows);
 }
 const b=req.body||{};
 if(!b.matchId||!UUID.test(String(b.matchId)))return res.status(404).json({error:'Institutional match not found'});
 if(req.method==='POST'){
  const m=await db.query('SELECT id FROM institutional_matches WHERE id=$1 AND project_id=$2',[b.matchId,id]);
  if(!m.rows.length)return res.status(404).json({error:'Institutional match not found'});
  const r=await db.query('INSERT INTO institutional_submissions(project_id,match_id,status) VALUES($1,$2,$3) ON CONFLICT(project_id,match_id) DO UPDATE SET updated_at=now() RETURNING id,project_id AS "projectId",match_id AS "matchId",status',[id,b.matchId,'pending_authorization']);
  await db.query('INSERT INTO gis_organization_audit(organization_id,member_id,action,metadata) VALUES($1,$2,$3,$4)',[tenant.organization_id,req.member.id,'INSTITUTIONAL_SUBMISSION_CREATED',JSON.stringify({project_id:id,submission_id:r.rows[0].id})]).catch(()=>{});
  return res.status(201).json(r.rows[0]);
 }
 if(!b.submissionId||!UUID.test(String(b.submissionId)))return res.status(404).json({error:'Submission not found'});
 const current=await db.query('SELECT id,status FROM institutional_submissions WHERE id=$1 AND project_id=$2',[b.submissionId,id]);
 if(!current.rows.length)return res.status(404).json({error:'Submission not found'});
 const next=b.status;if(!statuses.includes(next))return res.status(400).json({error:'Invalid submission status'});
 const cur=current.rows[0].status;
 if(next==='submitted'&&cur!=='pack_generated')return res.status(409).json({error:'Submission pack must be generated before submission'});
 if(next==='authorized'&&cur!=='pending_authorization')return res.status(409).json({error:'Submission is not awaiting authorization'});
 if(next==='pack_generated'&&cur!=='authorized')return res.status(409).json({error:'Submission must be authorized before pack generation'});
 const r=await db.query("UPDATE institutional_submissions SET status=$1,authorized_by=CASE WHEN $1='authorized' THEN $2 ELSE authorized_by END,authorized_at=CASE WHEN $1='authorized' THEN now() ELSE authorized_at END,submitted_at=CASE WHEN $1='submitted' THEN now() ELSE submitted_at END,received_at=CASE WHEN $1='received' THEN now() ELSE received_at END,decision_at=CASE WHEN $1='decided' THEN now() ELSE decision_at END,outcome=COALESCE($3,outcome),notes=COALESCE($4,notes),updated_at=now() WHERE id=$5 AND project_id=$6 RETURNING id,status,authorized_at AS \"authorizedAt\",submitted_at AS \"submittedAt\",received_at AS \"receivedAt\",decision_at AS \"decisionAt\",outcome,notes",[next,req.member.id,b.outcome||null,b.notes||null,b.submissionId,id]);
 await db.query('INSERT INTO gis_organization_audit(organization_id,member_id,action,metadata) VALUES($1,$2,$3,$4)',[tenant.organization_id,req.member.id,'INSTITUTIONAL_SUBMISSION_UPDATED',JSON.stringify({project_id:id,submission_id:b.submissionId,status:next})]).catch(()=>{});
 res.json(r.rows[0]);
}