import { db, storage } from 'hatchable';
export const access='admin'; export const methods=['GET','POST'];
const clean=(v,max)=>typeof v==='string'?v.trim().slice(0,max):'';
const hash=async b=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b))).map(x=>x.toString(16).padStart(2,'0')).join('');
const types=new Set(['INCORPORATION','REPRESENTATIVE_AUTHORIZATION','OFFICIAL_DOMAIN','OPERATING_DOCUMENT','OTHER']);
export default async function(req,res){
 const id=clean(req.query?.request_id||req.body?.request_id,80); if(!id)return res.status(400).json({error:'request_id is required'});
 const q=await db.query("SELECT id FROM commercial_workspace_requests WHERE id=$1",[id]); if(!q.rows.length)return res.status(404).json({error:'request not found'});
 if(req.method==='GET'){const r=await db.query("SELECT id,evidence_type,title,source_reference,verification_status,submitted_by,created_at,reviewed_at,review_note FROM commercial_workspace_request_evidence WHERE request_id=$1 ORDER BY created_at DESC",[id]);return res.json({request_id:id,evidence:r.rows});}
 const type=clean(req.body?.evidence_type,60).toUpperCase(),title=clean(req.body?.title,180),ref=clean(req.body?.source_reference,1000);if(!types.has(type)||!title)return res.status(400).json({error:'valid evidence_type and title are required'});
 const file=req.files?.find(f=>f.field==='file');if(!file&&!ref)return res.status(400).json({error:'file or source_reference is required'});if(file&&file.buffer.length>15*1024*1024)return res.status(413).json({error:'file exceeds 15 MB limit'});
 let key=null,h=null;if(file){h=await hash(file.buffer);const safe=(file.filename||'evidence').replace(/[^a-zA-Z0-9._-]/g,'_');key='commercial-request-evidence/'+id+'/'+crypto.randomUUID()+'-'+safe;await storage.put(key,file.buffer,file.contentType||'application/octet-stream');}
 const actor=String(req.member?.email||'admin').slice(0,200);
 const r=await db.query("INSERT INTO commercial_workspace_request_evidence(request_id,evidence_type,title,source_reference,storage_key,content_hash,submitted_by) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id,evidence_type,title,source_reference,storage_key,content_hash,verification_status,created_at",[id,type,title,ref||null,key,h,actor]);
 await db.query("INSERT INTO commercial_workspace_request_audit(request_id,action,actor,notes) VALUES($1,'EVIDENCE_ADDED',$2,$3)",[id,actor,title]);
 res.status(201).json({evidence:r.rows[0],publicExposure:false});
}