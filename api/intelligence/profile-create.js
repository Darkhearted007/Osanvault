import { db } from 'hatchable';
export const access='member';
export const methods=['POST'];
const clean=(v,max)=>typeof v==='string'?v.trim().slice(0,max):'';
export default async function(req,res){
 const body=req.body||{};
 const name=clean(body.name,160),businessType=clean(body.businessType,100),sector=clean(body.sector,100),location=clean(body.location,160),description=clean(body.description,1000);
 const errors=[];
 if(name.length<2)errors.push('A business/profile name is required.');
 if(!businessType)errors.push('Business type is required.');
 if(!sector)errors.push('Sector is required.');
 if(errors.length)return res.status(400).json({ok:false,errors});
 const existing=await db.query(`SELECT id FROM economic_onboarding_profiles WHERE owner_id=$1 AND data_environment='production' AND lower(display_name)=lower($2) LIMIT 1`,[req.member.id,name]);
 if(existing.rows.length)return res.status(409).json({ok:false,error:'A production profile with this name already exists.'});
 const r=await db.query(`INSERT INTO economic_onboarding_profiles(owner_id,display_name,data_environment,business_type,sector,location,description,onboarding_status) VALUES($1,$2,'production',$3,$4,$5,$6,'draft') RETURNING id,display_name AS name,business_type AS "businessType",sector,location,description,onboarding_status AS "onboardingStatus"`,[req.member.id,name,businessType,sector,location,description]);
 res.status(201).json({ok:true,profile:r.rows[0],next:'evidence'});
}