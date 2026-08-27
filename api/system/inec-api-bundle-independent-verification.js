import { db, storage } from 'hatchable';
export const access='admin';
export const methods=['POST'];
const SOURCE='INEC-POLLING-UNIT-LOCATOR-2026';
const BASE='https://cvr.inecnigeria.org';
async function sha(text){const d=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));return [...new Uint8Array(d)].map(x=>x.toString(16).padStart(2,'0')).join('')}
function key(path,q){return path+'|'+JSON.stringify(Object.fromEntries(Object.entries(q||{}).sort(([a],[b])=>a.localeCompare(b))))}
export default async function(req,res){
  const id=req.body?.artifact_id;
  if(!id)return res.status(400).json({error:'artifact_id is required',decision:'VERIFICATION_BLOCKED'});
  const a=(await db.query("SELECT id,source_url,canonical_source_key,source_registry_id,sha256,storage_key,byte_size,content_type,retrieval_status,verification_status,provenance_status,artifact_type FROM app_7855832537293bad.inec_official_artifacts WHERE id=$1",[id])).rows[0];
  if(!a)return res.status(404).json({error:'artifact not found',decision:'VERIFICATION_BLOCKED'});
  if(a.canonical_source_key!==SOURCE||a.retrieval_status!=='RETRIEVED'||a.artifact_type!=='official INEC machine-readable polling-unit API response bundle')return res.status(409).json({error:'artifact is not an eligible INEC API bundle',decision:'VERIFICATION_BLOCKED'});
  let obj;try{obj=await storage.get(a.storage_key)}catch(e){return res.status(409).json({error:'artifact storage unavailable',detail:String(e),decision:'VERIFICATION_BLOCKED'})}
  const text=new TextDecoder('utf-8',{fatal:true}).decode(obj.buffer); const computed=await sha(text);
  if(computed!==a.sha256||obj.buffer.byteLength!==Number(a.byte_size))return res.status(409).json({error:'bundle byte/hash integrity mismatch',recorded_sha256:a.sha256,computed_sha256:computed,recorded_byte_size:a.byte_size,computed_byte_size:obj.buffer.byteLength,decision:'VERIFICATION_BLOCKED'});
  let bundle;try{bundle=JSON.parse(text)}catch(e){return res.status(409).json({error:'bundle JSON invalid',decision:'VERIFICATION_BLOCKED'})}
  if(bundle.schema_version!=='391.29.1'||bundle.canonical_source_key!==SOURCE||bundle.transport_base!==BASE||!Array.isArray(bundle.entries)||bundle.entries.length===0)return res.status(409).json({error:'bundle schema/provenance signature invalid',decision:'VERIFICATION_BLOCKED'});
  const snapshots=(await db.query("SELECT request_query,endpoint_path,response_sha256,http_status,content_type,acquisition_status,provenance_status FROM app_7855832537293bad.inec_live_api_snapshots WHERE endpoint_path LIKE '/PublicApi/pus/%' AND acquisition_status='ACQUIRED'" )).rows;
  const byKey=new Map(snapshots.map(s=>[key(s.endpoint_path,s.request_query),s]));
  const uniqueRequests=[...new Map(bundle.entries.map(e=>[key(e.endpoint_path,e.request_query),e])).values()];
  let snapshotBound=0,refetchPass=0,refetchFail=0; const failures=[];
  for(let i=0;i<uniqueRequests.length;i+=12){
    const batch=uniqueRequests.slice(i,i+12);
    const rs=await Promise.all(batch.map(async e=>{
      const k=key(e.endpoint_path,e.request_query); const stored=byKey.get(k); if(!stored)return {key:k,status:'MISSING_SNAPSHOT'}; snapshotBound++;
      const qs=new URLSearchParams(e.request_query||{}); const url=BASE+e.endpoint_path+'?'+qs.toString();
      try{const r=await fetch(url,{redirect:'follow'});const body=await r.text();const h=await sha(body);const ok=r.status===stored.http_status&&String(r.headers.get('content-type')||'')===String(stored.content_type||'')&&h===stored.response_sha256&&r.ok;return {key:k,status:ok?'PASS':'MISMATCH',http_status:r.status,sha256:h,expected_sha256:stored.response_sha256}}catch(err){return {key,status:'FETCH_FAILED',error:String(err)}}
    }));
    for(const r of rs){if(r.status==='PASS')refetchPass++;else{refetchFail++;failures.push(r)}}
  }
  const complete=uniqueRequests.length===snapshotBound&&refetchFail===0;
  if(complete){await db.query("UPDATE app_7855832537293bad.inec_official_artifacts SET verification_status='VERIFIED',provenance_status='VERIFIED',notes=$1,updated_at=now() WHERE id=$2",[`Independent re-fetch verification passed for ${refetchPass} unique official INEC polling-unit API requests; bundle bytes/hash and all source response hashes matched.`,id]);}
  else await db.query("UPDATE app_7855832537293bad.inec_official_artifacts SET verification_status='PENDING_CONTENT_VALIDATION',provenance_status='SOURCE_BOUND_AND_HASH_VERIFIED',notes=$1,updated_at=now() WHERE id=$2",[`Independent verification incomplete: ${refetchPass} re-fetches matched and ${refetchFail} failed or mismatched; artifact remains fail-closed.`,id]);
  res.status(200).json({artifact_id:id,canonical_source_key:a.canonical_source_key,artifact_sha256:a.sha256,bundle_entries:bundle.entries.length,unique_transport_requests:uniqueRequests.length,snapshot_bound:snapshotBound,independent_refetch_pass:refetchPass,independent_refetch_failed:refetchFail,verification_status:complete?'VERIFIED':'PENDING_CONTENT_VALIDATION',provenance_status:complete?'VERIFIED':'SOURCE_BOUND_AND_HASH_VERIFIED',decision:complete?'INDEPENDENT_VERIFICATION_PASSED':'INDEPENDENT_VERIFICATION_BLOCKED',failures:failures.slice(0,20),policy:'Verification is independent of acquisition: stored bytes are re-hashed and every unique official transport request is re-fetched and compared to its retained response hash. No candidate status is mutated.'});
}