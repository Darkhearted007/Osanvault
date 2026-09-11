import { db } from 'hatchable';
import { authorizeTenant, tenantError } from '../../../lib/tenantAuthority.js';

export const access='member';
export const methods=['GET','POST','PUT'];
const allowed=['pending_authorization','authorized','revoked'];

export default async function(req,res){
  const projectId=String(req.params.id||'').trim();
  const project=await db.query('SELECT id,organization_id AS "organizationId" FROM projects WHERE id=$1',[projectId]);
  if(!project.rows.length)return res.status(404).json({error:'Project not found'});
  const organizationId=project.rows[0].organizationId;
  if(!organizationId)return res.status(403).json({error:'project_not_tenant_assigned'});
  const permission=req.method==='GET'?'capital:read':'capital:write';
  const tenant=await authorizeTenant(req,organizationId,permission);
  if(!tenant.allowed)return tenantError(res,tenant);

  if(req.method==='GET'){
    const r=await db.query('SELECT s.id,s.project_id AS "projectId",s.institution_id AS "institutionId",s.match_score AS "matchScore",s.match_state AS "matchState",s.authorization_state AS "authorizationState",s.authorized_at AS "authorizedAt",s.submission_state AS "submissionState",s.notes,i.organization_name AS "organizationName",i.organization_type AS "organizationType",i.mandate FROM institutional_match_submissions s JOIN institutional_profiles i ON i.id=s.institution_id WHERE s.project_id=$1 ORDER BY s.match_score DESC',[projectId]);
    return res.json(r.rows);
  }

  if(req.method==='POST'){
    const b=req.body||{};
    if(!b.institutionId)return res.status(400).json({error:'institutionId is required'});
    const score=Math.max(0,Math.min(100,Number(b.matchScore)||0));
    const institution=await db.query("SELECT id FROM institutional_profiles WHERE id=$1 AND status='active'",[b.institutionId]);
    if(!institution.rows.length)return res.status(404).json({error:'Institution not found'});
    const r=await db.query('INSERT INTO institutional_match_submissions(project_id,institution_id,match_score,match_state,notes) VALUES($1,$2,$3,$4,$5) ON CONFLICT(project_id,institution_id) DO UPDATE SET match_score=EXCLUDED.match_score,match_state=EXCLUDED.match_state,notes=EXCLUDED.notes,updated_at=now() RETURNING id,project_id AS "projectId",institution_id AS "institutionId",match_score AS "matchScore",match_state AS "matchState",authorization_state AS "authorizationState",submission_state AS "submissionState"',[projectId,b.institutionId,score,score>=75?'strong_match':score>=55?'possible_match':'weak_match',b.notes||null]);
    await db.query('INSERT INTO gis_organization_audit(organization_id,member_id,action,metadata) VALUES($1,$2,$3,$4)',[tenant.organization_id,req.member.id,'INSTITUTIONAL_MATCH_SUBMISSION_CREATED',JSON.stringify({project_id:projectId,match_id:r.rows[0].id})]).catch(()=>{});
    return res.status(201).json(r.rows[0]);
  }

  const b=req.body||{};
  if(!b.matchId||!allowed.includes(b.authorizationState))return res.status(400).json({error:'matchId and valid authorizationState are required'});
  if(b.authorizationState==='authorized'){
    const current=await db.query('SELECT id FROM institutional_match_submissions WHERE id=$1 AND project_id=$2',[b.matchId,projectId]);
    if(!current.rows.length)return res.status(404).json({error:'Institutional match not found'});
    const r=await db.query('UPDATE institutional_match_submissions SET authorization_state=$1,authorized_by=$2,authorized_at=now(),updated_at=now() WHERE id=$3 AND project_id=$4 RETURNING id,authorization_state AS "authorizationState",authorized_by AS "authorizedBy",authorized_at AS "authorizedAt",submission_state AS "submissionState"',[b.authorizationState,req.member.id,b.matchId,projectId]);
    await db.query('INSERT INTO gis_organization_audit(organization_id,member_id,action,metadata) VALUES($1,$2,$3,$4)',[tenant.organization_id,req.member.id,'INSTITUTIONAL_MATCH_AUTHORIZATION_CHANGED',JSON.stringify({project_id:projectId,match_id:b.matchId,authorization_state:b.authorizationState})]).catch(()=>{});
    return res.json(r.rows[0]);
  }
  const r=await db.query("UPDATE institutional_match_submissions SET authorization_state=$1,authorized_by=NULL,authorized_at=NULL,submission_state=CASE WHEN $1='revoked' THEN 'not_submitted' ELSE submission_state END,updated_at=now() WHERE id=$2 AND project_id=$3 RETURNING id,authorization_state AS \"authorizationState\",authorized_by AS \"authorizedBy\",authorized_at AS \"authorizedAt\",submission_state AS \"submissionState\"",[b.authorizationState,b.matchId,projectId]);
  if(!r.rows.length)return res.status(404).json({error:'Institutional match not found'});
  await db.query('INSERT INTO gis_organization_audit(organization_id,member_id,action,metadata) VALUES($1,$2,$3,$4)',[tenant.organization_id,req.member.id,'INSTITUTIONAL_MATCH_AUTHORIZATION_CHANGED',JSON.stringify({project_id:projectId,match_id:b.matchId,authorization_state:b.authorizationState})]).catch(()=>{});
  return res.json(r.rows[0]);
}