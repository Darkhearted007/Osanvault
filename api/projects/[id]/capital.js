import { db } from 'hatchable';
import { authorizeTenant, tenantError } from '../../../lib/tenantAuthority.js';
export const access='member';
export const methods=['GET','POST'];
export default async function(req,res){
 const id=req.params.id;
 const owner=await db.query('SELECT organization_id AS "organizationId" FROM projects WHERE id=$1',[id]);
 if(!owner.rows.length)return res.status(404).json({error:'Project not found'});
 if(!owner.rows[0].organizationId)return res.status(403).json({error:'project_not_tenant_assigned'});
 const tenant=await authorizeTenant(req,owner.rows[0].organizationId,req.method==='GET'?'capital:read':'capital:write');
 if(!tenant.allowed)return tenantError(res,tenant);
 if(req.method==='GET'){
  const[r,s,i]=await Promise.all([
   db.query('SELECT id,amount,currency,purpose,financing_stage AS "financingStage",target_date AS "targetDate",status,created_at AS "createdAt" FROM project_capital_requests WHERE project_id=$1 ORDER BY created_at DESC',[id]),
   db.query('SELECT id,source_type AS "sourceType",name,mandate,status,notes FROM project_capital_sources WHERE project_id=$1 ORDER BY created_at DESC',[id]),
   db.query('SELECT id,instrument_type AS "instrumentType",amount,currency,terms_summary AS "termsSummary",status FROM project_capital_instruments WHERE project_id=$1 ORDER BY created_at DESC',[id])
  ]);
  return res.json({capitalRequests:r.rows,sources:s.rows,instruments:i.rows});
 }
 const b=req.body||{};
 if(!b.amount||!b.purpose)return res.status(400).json({error:'amount and purpose are required'});
 const r=await db.query('INSERT INTO project_capital_requests(project_id,amount,currency,purpose,financing_stage,target_date,status) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id,amount,currency,purpose,financing_stage AS "financingStage",target_date AS "targetDate",status',[id,b.amount,b.currency||'NGN',b.purpose,b.financingStage||'pre_development',b.targetDate||null,'draft']);
 await db.query('INSERT INTO gis_organization_audit(organization_id,member_id,action,metadata) VALUES($1,$2,$3,$4)',[tenant.organization_id,req.member.id,'CAPITAL_REQUEST_CREATED',JSON.stringify({project_id:id,capital_request_id:r.rows[0].id})]).catch(()=>{});
 res.status(201).json(r.rows[0]);
}