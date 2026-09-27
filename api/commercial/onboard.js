import { db } from 'hatchable';
import { enforcePublicRateLimit } from 'lib/cac-public-rate-limit.js';
export const access='public'; export const methods=['POST'];
export default async function(req,res){
  if(!(await enforcePublicRateLimit(req,res,'commercial-onboard','',5)))return res.status(429).json({error:'Too many onboarding requests. Try again later.'});
  const b=req.body||{};
  const name=String(b.name||'').trim(), email=String(b.email||'').trim().toLowerCase();
  const org=String(b.organization||'').trim(), plan=String(b.plan||'explorer').trim().toLowerCase();
  const organizationType=String(b.organization_type||'').trim();
  const officialWebsite=String(b.official_website||b.website||'').trim();
  const officialDomain=String(b.official_domain||'').trim();
  const intendedUse=String(b.intended_use||b.use_case||'').trim();
  const geography=String(b.geography_of_interest||'').trim();
  if(!name||!email||!org||!organizationType)return res.status(400).json({error:'name, email, organization and organization type are required'});
  if(name.length>120||email.length>200||org.length>160||organizationType.length>120||officialWebsite.length>500||officialDomain.length>253||intendedUse.length>1000||geography.length>500)return res.status(400).json({error:'input exceeds allowed length'});
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return res.status(400).json({error:'valid email is required'});
  const p=(await db.query("SELECT plan_key,active,regulated_enabled FROM commercial_plans WHERE plan_key=$1",[plan])).rows[0];
  if(!p||!p.active||p.regulated_enabled)return res.status(400).json({error:'plan unavailable for non-regulated pilot'});
  const r=await db.query("INSERT INTO commercial_workspace_requests (name,email,organization,organization_type,plan,status,official_website,official_domain,intended_use,geography_of_interest) VALUES ($1,$2,$3,$4,$5,'PENDING',$6,$7,$8,$9) RETURNING id,status,created_at",[name,email,org,organizationType,plan,officialWebsite||null,officialDomain||null,intendedUse||null,geography||null]);
  res.status(201).json({ok:true,request_id:r.rows[0].id,status:r.rows[0].status,created_at:r.rows[0].created_at,next:'admin_review'});
}