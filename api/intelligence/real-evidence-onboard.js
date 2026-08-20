import { db } from 'hatchable';
export const access='member';
export const methods=['POST'];
const clean=(v,max=500)=>typeof v==='string'?v.trim().slice(0,max):'';
export default async function(req,res){
 const profileId=clean(req.body?.profileId,80), title=clean(req.body?.title,200), category=clean(req.body?.evidenceCategory,80), description=clean(req.body?.description,2000), sourceType=clean(req.body?.sourceType,80), fileUrl=clean(req.body?.fileUrl,1000);
 if(!profileId||!title||!category||!description||!sourceType)return res.status(400).json({ok:false,error:'profileId, title, evidenceCategory, description and sourceType are required.'});
 const p=await db.query(`SELECT id,display_name,data_environment FROM economic_onboarding_profiles WHERE id=$1 AND owner_id=$2 LIMIT 1`,[profileId,req.member.id]);
 if(!p.rows.length)return res.status(404).json({ok:false,error:'Profile not found for this member.'});
 if(p.rows[0].data_environment!=='production')return res.status(409).json({ok:false,error:'Evidence onboarding is restricted to production profiles.'});
 const r=await db.query(`INSERT INTO economic_evidence_vault(profile_id,evidence_category,title,description,source_type,verification_status,file_url,submitted_by,submitted_at,metadata) VALUES($1,$2,$3,$4,$5,'pending_review',$6,$7,now(),$8) RETURNING id,profile_id,evidence_category,title,description,source_type,verification_status,file_url,submitted_at`,[profileId,category,title,description,sourceType,fileUrl||null,req.member.id,JSON.stringify({productionEvidence:true,claimPolicy:'unverified_until_review'})]);
 res.status(201).json({ok:true,evidence:r.rows[0],claimPolicy:'unverified_until_review',publicExposure:false,next:'verify_evidence_before_intelligence'});
}