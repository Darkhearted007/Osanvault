import { db, storage } from 'hatchable';
export const access='admin'; export const methods=['POST'];
const SOURCE='https://cvr.inecnigeria.org/the_election_results/recentUploads';
export default async function(req,res){
  const r=await fetch(SOURCE,{redirect:'follow'});
  if(!r.ok)return res.status(502).json({error:'official INEC source retrieval failed',http_status:r.status});
  const text=await r.text();
  const bytes=new TextEncoder().encode(text);
  const digest=await crypto.subtle.digest('SHA-256',bytes);
  const hash=Array.from(new Uint8Array(digest)).map(x=>x.toString(16).padStart(2,'0')).join('');
  const key=`gis/ward-evidence/inec-recentUploads-${hash}.html`;
  const url=await storage.put(key,bytes,'text/html;charset=utf-8');
  const {rows}=await db.query("INSERT INTO ward_evidence_artifacts (source_key,artifact_name,resource_type,source_reference,version_label,content_hash,provenance_status,verification_status,notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id,source_key,artifact_name,resource_type,source_reference,content_hash,provenance_status,verification_status,received_at",['INEC_CVR','INEC Recently Uploaded Result Sheets snapshot','HTML','https://cvr.inecnigeria.org/the_election_results/recentUploads',new Date().toISOString(),hash,'SOURCE_VERIFIED','VERIFIED',`Official INEC page snapshot preserved at ${url}. This artifact supports ward/LGA identity provenance only; it does not certify polygon geometry.`]);
  res.status(201).json({artifact:rows[0],snapshot_url:url,http_status:r.status,bytes:bytes.length,policy:'Identity/electoral evidence only; no GIS exception is resolved automatically.'});
}