import { db } from 'hatchable';
export const access='admin';
export const methods=['POST'];
export default async function(req,res){
 const existing=await db.query(`SELECT id,display_name,data_environment,onboarding_status FROM economic_onboarding_profiles WHERE owner_id=$1 AND display_name='OSANVAULT AFRICA LTD' AND data_environment='production' LIMIT 1`,[req.member.id]);
 if(existing.rows.length)return res.json({ok:true,created:false,profile:existing.rows[0],publicExposure:false,next:'production_onboarding_gate'});
 const r=await db.query(`INSERT INTO economic_onboarding_profiles(owner_id,display_name,data_environment,business_type,sector,location,description,onboarding_status) VALUES($1,'OSANVAULT AFRICA LTD','production','Private Company Limited by Shares','Economic intelligence / real-world asset infrastructure','Ekiti State, Nigeria','First real production profile for ÒsánVault Africa Ltd. No evidence is asserted until supplied and verified.','draft') RETURNING id,display_name,data_environment,business_type,sector,location,description,onboarding_status`,[req.member.id]);
 res.status(201).json({ok:true,created:true,profile:r.rows[0],publicExposure:false,next:'add_real_evidence'});
}