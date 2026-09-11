import { db, storage } from 'hatchable';
export const access='member';
export const methods=['GET','POST'];
const clean=(v,max)=>typeof v==='string'?v.trim().slice(0,max):'';
export default async function(req,res){
 if(!req.member?.id)return res.status(401).json({ok:false,error:'authentication_required'});
 const profile=await db.query(`SELECT id,display_name FROM economic_onboarding_profiles WHERE owner_id=$1 AND lower(display_name)=lower($2) AND data_environment='production' ORDER BY created_at DESC LIMIT 1`,[req.member.id,'OSANVAULT AFRICA LTD']);
 if(!profile.rows.length)return res.status(404).json({ok:false,error:'Production profile not found.'});
 const p=profile.rows[0];
 if(req.method==='GET'){
  const r=await db.query(`SELECT id,title,evidence_category AS category,description,source_type,storage_url AS source_reference,verification_status,trust_score,reviewed_by,reviewed_at,metadata,created_at FROM economic_evidence_vault WHERE profile_id=$1 ORDER BY created_at DESC`,[p.id]);
  return res.json({ok:true,profile:p,evidence:r.rows,publicExposure:false,next:'submit_real_evidence'});
 }
 const title=clean(req.body?.title,180), category=clean(req.body?.category,100), description=clean(req.body?.description,2000), sourceType=clean(req.body?.sourceType,100), sourceReference=clean(req.body?.sourceReference,500);
 if(!title||!category||!description||!sourceType)return res.status(400).json({ok:false,error:'title, category, description and sourceType are required.'});
 const file=req.files?.find(f=>f.field==='file');
 if(!file)return res.status(400).json({ok:false,error:'A real evidence document is required.'});
 if(file.buffer.length>15*1024*1024)return res.status(413).json({ok:false,error:'Evidence file exceeds 15 MB limit.'});
 const safeName=(file.filename||'evidence').replace(/[^a-zA-Z0-9._-]/g,'_');
 const key=`evidence/${p.id}/${crypto.randomUUID()}-${safeName}`;
 const fileUrl=await storage.put(key,file.buffer,file.contentType||'application/octet-stream');
 const metadata={filename:file.filename,contentType:file.contentType||'application/octet-stream',size:file.buffer.length,storageKey:key};
 const ref=sourceReference||fileUrl;
 const r=await db.query(`INSERT INTO economic_evidence_vault(profile_id,evidence_category,title,description,source_type,storage_url,metadata,verification_status,submitted_by,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,'submitted',$8,now()) RETURNING id,title,evidence_category AS category,description,source_type,storage_url AS source_reference,verification_status,metadata,created_at`,[p.id,category,title,description,sourceType,ref,JSON.stringify(metadata),req.member.id]);
 res.status(201).json({ok:true,evidence:r.rows[0],trustedSignalCreated:false,publicExposure:false,next:'independent_verification'});
}