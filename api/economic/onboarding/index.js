import { db } from 'hatchable';
export const access = 'member';
export const methods = ['GET','POST'];
export default async function(req,res) {
  const member = req.member;
  if (req.method === 'GET') {
    const r = await db.query('SELECT id,display_name AS "displayName",business_type AS "businessType",sector,locality,operating_since AS "operatingSince",description,status,created_at AS "createdAt" FROM economic_onboarding_profiles WHERE owner_id=$1 ORDER BY created_at DESC',[member.id]);
    return res.json({profiles:r.rows});
  }
  const b = req.body || {};
  if (!b.displayName || !b.businessType || !b.sector || !b.locality) return res.status(400).json({error:'displayName, businessType, sector and locality are required'});
  const r = await db.query('INSERT INTO economic_onboarding_profiles(owner_id,display_name,business_type,sector,locality,operating_since,description,status,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,now(),now()) RETURNING id,display_name AS "displayName",business_type AS "businessType",sector,locality,operating_since AS "operatingSince",description,status',[member.id,b.displayName,b.businessType,b.sector,b.locality,b.operatingSince || null,b.description || null,'active']);
  await db.query('INSERT INTO economic_onboarding_events(profile_id,event_type,actor_id,details) VALUES($1,$2,$3,$4)',[r.rows[0].id,'profile_created',member.id,JSON.stringify({source:'self_onboarding'})]);
  return res.status(201).json({profile:r.rows[0],passportUrl:'/economic-passport.html?profile='+r.rows[0].id});
}