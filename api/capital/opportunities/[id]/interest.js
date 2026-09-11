import { db } from 'hatchable';
import { authorizeTenant, tenantError } from 'lib/tenantAuthority.js';
export const access='admin';
export const methods=['POST'];
export default async function(req,res){
 const id=String(req.params?.id||'').trim();
 const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;
 const b=req.body||{};
 if(!UUID.test(id))return res.status(404).json({error:'Opportunity not found'});
 if(!b.institutionId||!b.interestType)return res.status(400).json({error:'institutionId and interestType are required'});
 const op=await db.query('SELECT co.id,p.organization_id AS "organizationId" FROM capital_opportunities co JOIN projects p ON p.id=co.project_id WHERE co.id=$1 AND co.status IN (\'diligence\',\'open\')',[id]);
 if(!op.rows.length)return res.status(404).json({error:'Opportunity not found'});
 if(!op.rows[0].organizationId)return res.status(403).json({error:'opportunity_not_tenant_assigned'});
 const tenant=await authorizeTenant(req,op.rows[0].organizationId,'capital:write');
 if(!tenant.allowed)return tenantError(res,tenant);
 const own=await db.query('SELECT id FROM institutional_profiles WHERE id=$1',[b.institutionId]);
 if(!own.rows.length)return res.status(404).json({error:'Institution not found'});
 const r=await db.query('INSERT INTO transaction_interests(opportunity_id,institution_id,interest_type,amount,currency,message) VALUES($1,$2,$3,$4,$5,$6) RETURNING id,opportunity_id AS "opportunityId",interest_type AS "interestType",amount,currency,status,created_at AS "createdAt"',[id,b.institutionId,b.interestType,b.amount||null,b.currency||'NGN',b.message||null]);
 await db.query('INSERT INTO gis_organization_audit(organization_id,member_id,action,metadata) VALUES($1,$2,$3,$4)',[tenant.organization_id,req.member.id,'CAPITAL_INTEREST_SUBMITTED',JSON.stringify({opportunity_id:id,interest_id:r.rows[0].id,institution_id:b.institutionId})]).catch(()=>{});
 res.status(201).json({...r.rows[0],notice:'Non-binding institutional expression of interest. No funds are accepted and no investment security is created through this endpoint.'});
}