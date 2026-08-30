import { db } from 'hatchable';
export const access='admin';
export const methods=['POST'];
const clean=(v,max)=>typeof v==='string'?v.trim().slice(0,max):'';
export default async function(req,res){
 const name=clean(req.body?.displayName,160), type=clean(req.body?.businessType,120), sector=clean(req.body?.sector,160), location=clean(req.body?.location,160), description=clean(req.body?.description,1000);
 if(!name||!type||!sector)return res.status(400).json({ok:false,error:'displayName, businessType and sector are required.'});
 const existing=await db.query(`SELECT id,display_name AS "displayName",data_environment AS "dataEnvironment",onboarding_status AS "onboardingStatus" FROM economic_onboarding_profiles WHERE owner_id=$1 AND lower(display_name)=lower($2) AND data_environment='production' LIMIT 1`,[req.member.id,name]);
 if(existing.rows.length)return res.json({ok:true,created:false,profile:existing.rows[0],publicExposure:false});
 const r=await db.query(`INSERT INTO economic_onboarding_profiles(owner_id,display_name,business_type,sector,location,description,data_environment,onboarding_status) VALUES($1,$2,$3,$4,$5,$6,'production','draft') RETURNING id,display_name AS "displayName",business_type AS "businessType",sector,location,description,data_environment AS "dataEnvironment",onboarding_status AS "onboardingStatus",created_at AS "createdAt"`,[req.member.id,name,type,sector,location,description]);
 res.status(201).json({ok:true,created:true,profile:r.rows[0],publicExposure:false,next:'real_evidence_onboarding'});
}