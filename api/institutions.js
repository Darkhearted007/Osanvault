import { db } from 'hatchable';
import { enforcePublicRateLimit } from 'lib/cac-public-rate-limit.js';
export const access = 'public';
export const methods = ['POST'];
export default async function(req,res){
 const b=req.body||{}; if(!b.organizationName||!b.organizationType)return res.status(400).json({error:'organizationName and organizationType are required'}); if(!(await enforcePublicRateLimit(req,res,'institution-onboarding',String(b.organizationName).slice(0,160),10)))return res.status(429).json({error:'Too many institutional requests. Try again later.'});
 const r=await db.query('INSERT INTO institutional_profiles(organization_name,organization_type,jurisdiction,website,mandate,status) VALUES($1,$2,$3,$4,$5,$6) RETURNING id,organization_name AS "organizationName",organization_type AS "organizationType",jurisdiction,website,mandate,status',[b.organizationName,b.organizationType,b.jurisdiction||null,b.website||null,b.mandate||null,'prospect']);
 res.status(201).json(r.rows[0]);
}