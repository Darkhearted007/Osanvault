import { db } from 'hatchable';
import { enforcePublicRateLimit } from 'lib/cac-public-rate-limit.js';

export const access = 'public';
export const methods = ['POST'];

const clean = (value,max) => typeof value === 'string' ? value.trim().slice(0,max) : '';

export default async function(req,res) {
  const body = req.body || {};
  const organizationName = clean(body.organizationName,180);
  const organizationType = clean(body.organizationType,120);
  const jurisdiction = clean(body.jurisdiction,160);
  const website = clean(body.website,500);
  const mandate = clean(body.mandate,1500);

  if (!organizationName || !organizationType) {
    return res.status(400).json({error:'organizationName and organizationType are required'});
  }
  if ((body.organizationName != null && typeof body.organizationName !== 'string') ||
      (body.organizationType != null && typeof body.organizationType !== 'string') ||
      (body.jurisdiction != null && typeof body.jurisdiction !== 'string') ||
      (body.website != null && typeof body.website !== 'string') ||
      (body.mandate != null && typeof body.mandate !== 'string')) {
    return res.status(400).json({error:'institution fields must be strings'});
  }
  if (website && !/^https?:\/\/[^\s]{1,490}$/i.test(website)) {
    return res.status(400).json({error:'website must be an http(s) URL'});
  }
  if (!(await enforcePublicRateLimit(req,res,'institution-onboarding',organizationName.toLowerCase(),10))) {
    return res.status(429).json({error:'Too many institutional requests. Try again later.'});
  }

  const result = await db.query(
    'INSERT INTO institutional_profiles(organization_name,organization_type,jurisdiction,website,mandate,status) VALUES($1,$2,$3,$4,$5,$6) RETURNING id,organization_name AS "organizationName",organization_type AS "organizationType",jurisdiction,website,mandate,status',
    [organizationName,organizationType,jurisdiction||null,website||null,mandate||null,'prospect']
  );
  return res.status(201).json(result.rows[0]);
}
