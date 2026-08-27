import { db, storage } from 'hatchable';
export const access='admin';
export const methods=['GET'];
export default async function(req,res){
 const q=await db.query("SELECT id,source_url,authority,retrieval_status,http_status,content_type,byte_size,sha256,storage_key,verification_status,provenance_status,canonical_source_key,source_registry_id FROM inec_official_artifacts WHERE canonical_source_key=$1 ORDER BY created_at DESC LIMIT 10",['INEC-POLLING-UNIT-LOCATOR-2026']);
 const audits=[];
 for(const a of q.rows){
  if(a.retrieval_status!=='RETRIEVED'||!a.storage_key||!a.sha256){audits.push({artifact_id:a.id,decision:'NOT_CERTIFIED',reason:'artifact is not a successfully retrieved, hashed, stored artifact'});continue;}
  try{
   const g=await storage.get(a.storage_key); if(!g?.buffer) throw new Error('stored artifact bytes unavailable');
   const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',g.buffer))].map(b=>b.toString(16).padStart(2,'0')).join('');
   const text=new TextDecoder().decode(g.buffer.slice(0,Math.min(g.buffer.length,200000)));
   const originMatch=/^https:\/\/(?:cvr\.)?inecnigeria\.org(?:\/|$)/i.test(a.source_url||'');
   const typeValid=String(a.content_type||'').toLowerCase().startsWith('text/html');
   const signatureValid=/^<!doctype html|^<html/i.test(text.trim());
   const characteristics={has_inec:/\bINEC\b|Independent National Electoral Commission/i.test(text),has_polling_unit:/polling unit/i.test(text),has_locator:/locator|where your polling unit/i.test(text),title:(text.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||'').replace(/\s+/g,' ').trim().slice(0,300)};
   const hashMatch=hash===a.sha256; const decision=hashMatch&&originMatch&&typeValid&&signatureValid?'CONTENT_INTEGRITY_CONFIRMED':'NOT_CERTIFIED';
   audits.push({artifact_id:a.id,decision,byte_length:g.buffer.length,computed_sha256:hash,recorded_sha256:a.sha256,hash_match:hashMatch,origin_match:originMatch,content_type_valid:typeValid,content_signature_valid:signatureValid,content_characteristics:characteristics});
  }catch(e){audits.push({artifact_id:a.id,decision:'NOT_CERTIFIED',reason:String(e?.message||e)});}
 }
 const r=await db.query('INSERT INTO artifact_content_provenance_audits(phase,artifact_id,byte_length,computed_sha256,recorded_sha256,hash_match,origin_match,content_type_valid,content_signature_valid,content_characteristics,decision,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id',['391.10',audits[0]?.artifact_id||q.rows[0]?.id||'00000000-0000-0000-0000-000000000000',audits[0]?.byte_length||null,audits[0]?.computed_sha256||null,audits[0]?.recorded_sha256||null,!!audits[0]?.hash_match,!!audits[0]?.origin_match,!!audits[0]?.content_type_valid,!!audits[0]?.content_signature_valid,JSON.stringify(audits[0]?.content_characteristics||{}),audits[0]?.decision||'NOT_CERTIFIED','Observation-only content/provenance audit. Does not alter artifact, evidence, candidate, review, or promotion status.']);
 res.status(200).json({phase:'391.10',auditId:r.rows[0].id,artifacts:audits,production_gate:'NOT_READY'});
}