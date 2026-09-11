import { db } from 'hatchable';
import { authorizeTenant, tenantError } from '../../../lib/tenantAuthority.js';
export const access = 'member';
export const methods = ['POST'];
export default async function(req,res){
 const id=req.params.id,b=req.body||{};
 if(!b.institutionId||!b.interestType)return res.status(400).json({error:'institutionId and interestType are required'});
 const project=await db.query('SELECT id,organization_id AS "organizationId" FROM projects WHERE id=$1',[id]);
 if(!project.rows.length)return res.status(404).json({error:'Project not found'});
 if(!project.rows[0].organizationId)return res.status(403).json({error:'project_not_tenant_assigned'});
 const tenant=await authorizeTenant(req,project.rows[0].organizationId,'capital:write');
 if(!tenant.allowed)return tenantError(res,tenant);
 const institution=await db.query("SELECT id FROM institutional_profiles WHERE id=$1 AND status='active'",[b.institutionId]);
 if(!institution.rows.length)return res.status(404).json({error:'Institution not found'});
 const r=await db.query('INSERT INTO project_capital_interests(project_id,institution_id,interest_type,amount,currency,message,status) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id,project_id AS "projectId",institution_id AS "institutionId",interest_type AS "interestType",amount,currency,message,status,created_at AS "createdAt"',[id,b.institutionId,b.interestType,b.amount||null,b.currency||'NGN',b.message||null,'submitted']);
 await db.query('INSERT INTO gis_organization_audit(organization_id,member_id,action,metadata) VALUES($1,$2,$3,$4)',[tenant.organization_id,req.member.id,'CAPITAL_INTEREST_SUBMITTED',JSON.stringify({project_id:id,interest_id:r.rows[0].id})]).catch(()=>{});
 res.status(201).json({...r.rows[0],notice:'Non-binding expression of interest. No funds are accepted through this endpoint.'});
}