import { db } from 'hatchable';
export const access='public'; export const methods=['POST'];
export default async function(req,res){
  const b=req.body||{};
  const name=String(b.name||'').trim(), email=String(b.email||'').trim().toLowerCase();
  const org=String(b.organization||'').trim(), plan=String(b.plan||'enterprise').trim().toLowerCase();
  const organizationType=String(b.organization_type||'').trim();
  if(!name||!email||!org||!organizationType)return res.status(400).json({error:'name, email, organization and organization type are required'});
  if(name.length>120||email.length>200||org.length>160||organizationType.length>120)return res.status(400).json({error:'input exceeds allowed length'});
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return res.status(400).json({error:'valid email is required'});
  const p=(await db.query("SELECT plan_key,active,regulated_enabled FROM commercial_plans WHERE plan_key=$1",[plan])).rows[0];
  if(!p||!p.active||p.regulated_enabled)return res.status(400).json({error:'plan unavailable for non-regulated onboarding'});
  const {rows}=await db.query("INSERT INTO commercial_workspace_requests (name,email,organization,organization_type,plan,status) VALUES ($1,$2,$3,$4,$5,'PENDING') RETURNING id,status,created_at",[name,email,org,organizationType,plan]);
  res.status(201).json({request_id:rows[0].id,status:rows[0].status,created_at:rows[0].created_at});
}