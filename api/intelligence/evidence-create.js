import { db, storage } from 'hatchable';
export const access='member';
export const methods=['POST'];
const clean=(v,max)=>typeof v==='string'?v.trim().slice(0,max):'';
export default async function(req,res){
 const body=req.body||{};
 const profileId=clean(body.profileId,80),category=clean(body.category,100),type=clean(body.type,100),title=clean(body.title,200),source=clean(body.source,200),notes=clean(body.notes,1000);
 if(!profileId||!category||!type||!title)return res.status(400).json({ok:false,error:'profileId, category, type and title are required.'});
 const p=await db.query(`SELECT id FROM economic_onboarding_profiles WHERE id=$1 AND owner_id=$2 AND data_environment='production' LIMIT 1`,[profileId,req.member.id]);
 if(!p.rows.length)return res.status(404).json({ok:false,error:'Production profile not found.'});
 let fileUrl=null;
 if(req.files?.length){const f=req.files[0];if(f.buffer?.length>10*1024*1024)return res.status(413).json({ok:false,error:'Evidence file exceeds 10MB.'});const key=`evidence/${req.member.id}/${profileId}/${Date.now()}-${f.filename.replace(/[^a-zA-Z0-9._-]/g,'_')}`;fileUrl=await storage.put(key,f.buffer,f.contentType||'application/octet-stream');}
 const r=await db.query(`INSERT INTO economic_evidence_vault(profile_id,evidence_category,evidence_type,source_type,verification_status,title,notes,file_url,submitted_by) VALUES($1,$2,$3,$4,'pending',$5,$6,$7,$8) RETURNING id,title,verification_status AS "verificationStatus",file_url AS "fileUrl",submitted_at AS "submittedAt"`,[profileId,category,type,source||'user_submitted',title,notes,fileUrl,req.member.id]);
 res.status(201).json({ok:true,evidence:r.rows[0],next:'verification'});
}