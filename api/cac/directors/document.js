import { db, storage } from 'hatchable';
import { sha256Hex } from 'lib/cac-director-security.js';
export const access = 'public';
export const methods = ['POST'];
export default async function(req,res){
  const token=String(req.body?.token||'');
  const file=req.files?.find(f=>f.field==='document');
  if(!token || !file) return res.status(400).json({error:'Invite token and ID document are required'});
  const tokenHash=await sha256Hex(token);
  const {rows}=await db.query(`SELECT i.id AS "inviteId", i.expires_at AS "expiresAt", d.id AS "directorId" FROM cac_director_invites i JOIN cac_director_profiles d ON d.id=i.director_id WHERE i.token_hash=$1 LIMIT 1`,[tokenHash]);
  if(!rows.length) return res.status(404).json({error:'Invite not found'});
  if(new Date(rows[0].expiresAt)<=new Date()) return res.status(410).json({error:'This invitation has expired'});
  const allowed=['image/jpeg','image/png','application/pdf'];
  if(!allowed.includes(file.contentType)) return res.status(415).json({error:'Upload a PDF, JPG or PNG'});
  if(file.buffer.length>8*1024*1024) return res.status(413).json({error:'Maximum document size is 8MB'});
  const fileHash=await sha256Hex(file.buffer);
  const key=`cac/directors/${rows[0].directorId}/${fileHash}-${String(file.filename||'id-document').replace(/[^a-zA-Z0-9._-]/g,'_')}`;
  const url=await storage.put(key,file.buffer,file.contentType);
  await db.query(`UPDATE cac_director_profiles SET id_document_url=$1,id_document_name=$2,id_document_hash=$3,id_document_status='submitted',updated_at=now() WHERE id=$4`,[url,file.filename,fileHash,rows[0].directorId]);
  await db.query(`INSERT INTO cac_director_audit_events (director_id,invite_id,event_type,actor,metadata) VALUES ($1,$2,'id_document_submitted','invitee',$3)`,[rows[0].directorId,rows[0].inviteId,JSON.stringify({filename:file.filename,contentType:file.contentType,sha256:fileHash})]);
  res.json({ok:true,status:'submitted',filename:file.filename});
}