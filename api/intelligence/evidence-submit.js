import { db } from 'hatchable';
export const access='member';
export const methods=['POST'];
const clean=(v,n)=>typeof v==='string'?v.trim().slice(0,n):'';
export default async function(req,res){
 const profileId=clean(req.body?.profileId,80), title=clean(req.body?.title,200), category=clean(req.body?.category,80), description=clean(req.body?.description,2000), source=clean(req.body?.source,500), sourceType=clean(req.body?.sourceType,40).toLowerCase();
 if(!profileId||!title||!category||!description||!sourceType)return res.status(400).json({ok:false,error:'profileId, title, category, description and sourceType are required.'});
if(!['self_reported','uploaded','third_party','system_generated'].includes(sourceType))return res.status(400).json({ok:false,error:'sourceType must be self_reported, uploaded, third_party or system_generated.'});
 const p=await db.query(`SELECT id,data_environment FROM economic_onboarding_profiles WHERE id=$1 AND owner_id=$2 LIMIT 1`,[profileId,req.member.id]);
 if(!p.rows.length)return res.status(404).json({ok:false,error:'Production profile not found for this member.'});
 if(p.rows[0].data_environment!=='production')return res.status(409).json({ok:false,error:'Evidence can only be submitted to a production profile.'});
 const e=await db.query(`INSERT INTO economic_evidence_vault(profile_id,evidence_category,source_type,verification_status,title,description,submitted_by,submitted_at) VALUES($1,$2,$3,'submitted',$4,$5,$6,now()) RETURNING id,title,verification_status AS "verificationStatus",created_at AS "createdAt"`,[profileId,category,sourceType,title,description,req.member.id]);
 await db.query(`INSERT INTO economic_evidence_verification_events(evidence_id,profile_id,from_status,to_status,actor_id,notes) VALUES($1,$2,NULL,'submitted',$3,'Evidence submitted for controlled verification.')`,[e.rows[0].id,profileId,req.member.id]);
 res.status(201).json({ok:true,evidence:e.rows[0],publicExposure:false,next:'verification_review'});
}