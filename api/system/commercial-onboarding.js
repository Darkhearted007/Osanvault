import { storage } from 'hatchable';
import { enforcePublicRateLimit } from 'lib/cac-public-rate-limit.js';

export const access = 'public';
export const methods = ['POST'];

const clean = (value, max) => typeof value === 'string' ? value.trim().slice(0, max) : '';

export default async function(req,res) {
  const body = req.body || {};
  const email = clean(body.email, 200).toLowerCase();
  const organization = clean(body.organization, 160);
  const interest = clean(body.interest || 'enterprise-workspace', 100);

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ok:false,error:'valid_email_required'});
  }
  if (body.organization != null && typeof body.organization !== 'string') {
    return res.status(400).json({ok:false,error:'invalid_organization'});
  }
  if (body.interest != null && typeof body.interest !== 'string') {
    return res.status(400).json({ok:false,error:'invalid_interest'});
  }
  if (!(await enforcePublicRateLimit(req,res,'system-commercial-onboarding',email,5))) {
    return res.status(429).json({ok:false,error:'too_many_onboarding_requests'});
  }

  const lead = {
    id: crypto.randomUUID(),
    email,
    organization: organization || null,
    interest,
    created_at: new Date().toISOString(),
    status: 'new'
  };
  await storage.put(
    `phase389/leads/${lead.id}.json`,
    new TextEncoder().encode(JSON.stringify(lead)),
    'application/json'
  );
  return res.status(201).json({ok:true,id:lead.id,status:'received',next:'account_review'});
}
