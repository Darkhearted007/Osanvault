import { db } from 'hatchable';
export const access = 'member';
export const methods = ['GET','POST'];

export default async function(req,res) {
  const member = req.member;
  if (!member?.id) return res.status(401).json({error:'unauthorized'});

  if (req.method === 'GET') {
    const r = await db.query(
      'SELECT id, display_name AS "displayName", business_type AS "businessType", sector, location AS locality, description, onboarding_status AS status, created_at AS "createdAt" FROM economic_onboarding_profiles WHERE owner_id=$1 ORDER BY created_at DESC',
      [member.id]
    );
    return res.json({profiles:r.rows});
  }

  const b = req.body || {};
  const displayName = typeof b.displayName === 'string' ? b.displayName.trim().slice(0,180) : '';
  const businessType = typeof b.businessType === 'string' ? b.businessType.trim().slice(0,100) : '';
  const sector = typeof b.sector === 'string' ? b.sector.trim().slice(0,100) : '';
  const locality = typeof b.locality === 'string' ? b.locality.trim().slice(0,180) : '';
  const description = typeof b.description === 'string' ? b.description.trim().slice(0,2000) : null;
  if (!displayName || !businessType || !sector || !locality) {
    return res.status(400).json({error:'displayName, businessType, sector and locality are required'});
  }

  const r = await db.query(
    "INSERT INTO economic_onboarding_profiles(owner_id,display_name,business_type,sector,location,description,data_environment,onboarding_status,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,'production','active',now(),now()) RETURNING id,display_name AS \"displayName\",business_type AS \"businessType\",sector,location AS locality,description,onboarding_status AS status,created_at AS \"createdAt\"",
    [member.id,displayName,businessType,sector,locality,description]
  );
  await db.query(
    'INSERT INTO economic_onboarding_events(profile_id,event_type,actor_id,details) VALUES($1,$2,$3,$4)',
    [r.rows[0].id,'profile_created',String(member.id),JSON.stringify({source:'self_onboarding'})]
  );
  return res.status(201).json({profile:r.rows[0],passportUrl:'/economic-passport.html?profile='+r.rows[0].id});
}
