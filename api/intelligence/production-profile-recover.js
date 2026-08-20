import { db } from 'hatchable';
export const access='member';
export const methods=['POST'];
export default async function(req,res){
 const member=req.member;
 const existing=await db.query(`SELECT id,display_name,data_environment,onboarding_status FROM economic_onboarding_profiles WHERE owner_id=$1 AND display_name='OSANVAULT AFRICA LTD' AND data_environment='production' LIMIT 1`,[member.id]);
 if(existing.rows.length)return res.json({ok:true,recovered:false,profile:existing.rows[0],evidenceCreated:0,publicExposure:false,next:'real_evidence_onboarding'});
 const r=await db.query(`INSERT INTO economic_onboarding_profiles(owner_id,display_name,business_type,sector,location,description,data_environment,onboarding_status) VALUES($1,'OSANVAULT AFRICA LTD','Private Company Limited by Shares','Economic intelligence / real-world asset infrastructure','Ekiti State, Nigeria','Private production profile for ÒsánVault Africa. Evidence must be supplied and verified before intelligence processing.','production','draft') RETURNING id,display_name,business_type,sector,location,description,data_environment,onboarding_status`,[member.id]);
 res.status(201).json({ok:true,recovered:true,profile:r.rows[0],evidenceCreated:0,claimsVerified:0,publicExposure:false,next:'real_evidence_onboarding'});
}