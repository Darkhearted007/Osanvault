import { db, storage } from 'hatchable';
export const access='admin'; export const methods=['POST'];
const PARSER_VERSION='391.11.2';
async function hashBytes(buf){const d=await crypto.subtle.digest('SHA-256',buf);return Array.from(new Uint8Array(d)).map(x=>x.toString(16).padStart(2,'0')).join('');}
function clean(s){return String(s||'').replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim()}
function selectOptions(html,name){
  const blocks=html.match(/<select\b[\s\S]*?<\/select>/gi)||[];
  for(const block of blocks){
    const open=block.slice(0,block.indexOf('>')+1);
    const attrs=[...open.matchAll(/(?:id|name)\s*=\s*["']([^"']+)["']/gi)].map(m=>m[1]);
    if(!attrs.includes(name))continue;
    return [...block.matchAll(/<option\b([^>]*)>([\s\S]*?)<\/option>/gi)].map(x=>{const vm=x[1].match(/\bvalue\s*=\s*["']([^"']*)["']/i);return {value:vm?vm[1]:'',label:clean(x[2]),raw:x[0]}}).filter(x=>x.value);
  }
  return null;
}
export default async function(req,res){
  const artifactId=req.body?.artifact_id;
  if(!artifactId)return res.status(400).json({error:'artifact_id is required'});
  const a=(await db.query('SELECT id,source_registry_id,canonical_source_key,sha256,retrieval_status,verification_status,provenance_status,storage_key,source_url,content_type,byte_size FROM inec_official_artifacts WHERE id=$1 LIMIT 1',[String(artifactId)])).rows[0];
  if(!a)return res.status(404).json({error:'artifact not found'});
  const eligible=a.canonical_source_key==='INEC-POLLING-UNIT-LOCATOR-2026'&&a.retrieval_status==='RETRIEVED'&&!!a.sha256&&a.provenance_status==='SOURCE_BOUND_AND_HASH_VERIFIED'&&(a.verification_status==='PENDING_CONTENT_VALIDATION'||a.verification_status==='VERIFIED');
  if(!eligible)return res.status(409).json({error:'artifact is not eligible for deterministic parsing',decision:'PARSE_BLOCKED_ARTIFACT_NOT_FULLY_VERIFIED',candidate_mutation:false});
  let s;try{s=await storage.get(a.storage_key)}catch(e){return res.status(422).json({error:'stored artifact unavailable',decision:'PARSE_BLOCKED_STORAGE_UNAVAILABLE',detail:String(e),candidate_mutation:false});}
  if(!s?.buffer?.length)return res.status(422).json({error:'stored artifact is empty',decision:'PARSE_BLOCKED_EMPTY_ARTIFACT',candidate_mutation:false});
  const actual=await hashBytes(s.buffer);
  if(actual!==a.sha256)return res.status(409).json({error:'stored artifact hash mismatch',decision:'PARSE_BLOCKED_HASH_MISMATCH',recorded_sha256:a.sha256,computed_sha256:actual,candidate_mutation:false});
  if(Number.isFinite(Number(a.byte_size))&&Number(a.byte_size)!==s.buffer.byteLength)return res.status(409).json({error:'stored artifact byte-size mismatch',decision:'PARSE_BLOCKED_BYTE_SIZE_MISMATCH',recorded_byte_size:Number(a.byte_size),computed_byte_size:s.buffer.byteLength,candidate_mutation:false});
  let html;try{html=new TextDecoder('utf-8',{fatal:true}).decode(s.buffer)}catch(e){return res.status(422).json({error:'stored artifact is not valid UTF-8',decision:'PARSE_BLOCKED_ENCODING',candidate_mutation:false});}
  if(!/^\s*<!doctype\s+html[\s>]/i.test(html)&&!/^\s*<html[\s>]/i.test(html))return res.status(422).json({error:'stored artifact is not valid HTML',decision:'PARSE_BLOCKED_FORMAT',candidate_mutation:false});
  if(!/<\/html>\s*$/i.test(html))return res.status(422).json({error:'stored artifact has incomplete HTML document',decision:'PARSE_BLOCKED_MALFORMED_HTML',candidate_mutation:false});
  const stateName='data[Search][state_id]',lgaName='data[Search][local_government_id]',regAreaName='data[Search][registration_area_id]',puName='data[Search][polling_unit_id]';
  const states=selectOptions(html,stateName),lgas=selectOptions(html,lgaName),regAreas=selectOptions(html,regAreaName),pus=selectOptions(html,puName); const errors=[];
  if(!states)errors.push({code:'MISSING_STATE_SELECTOR',field:stateName});
  if(!lgas)errors.push({code:'MISSING_LGA_SELECTOR',field:lgaName});
  if(!regAreas)errors.push({code:'MISSING_REGISTRATION_AREA_SELECTOR',field:regAreaName});
  if(!pus)errors.push({code:'MISSING_POLLING_UNIT_SELECTOR',field:puName});
  if(!states||states.length===0)return res.status(422).json({error:'required state selector is absent or empty',decision:'PARSE_BLOCKED_REQUIRED_STRUCTURE',errors,candidate_mutation:false});
  const parsedAt=new Date().toISOString();
  const evidence={artifact_id:a.id,artifact_id_type:'uuid',source_registry_id:a.source_registry_id,canonical_source_key:a.canonical_source_key,provenance_reference:{source_registry_id:a.source_registry_id,source_url:a.source_url},artifact_sha256:a.sha256,parser_version:PARSER_VERSION,parse_timestamp:parsedAt,stored_byte_size:s.buffer.byteLength,record_count:states.length,selector_counts:{states:states.length,local_governments:lgas?.length??0,registration_areas:regAreas?.length??0,polling_units:pus?.length??0},errors,extraction_mode:'deterministic HTML select-option extraction',candidate_mutation:false};
  let inserted=0;
  for(const r of states){const rowHash=await hashBytes(new TextEncoder().encode(JSON.stringify({artifact_id:a.id,state_code:r.value,state_name:r.label,source_url:a.source_url,raw:r.raw})));const q=await db.query('INSERT INTO gis_official_artifact_rows(artifact_id,state_name,polling_unit_name,source_page,raw_text,row_hash) SELECT $1,$2,$3,$4,$5,$6 WHERE NOT EXISTS (SELECT 1 FROM gis_official_artifact_rows WHERE artifact_id=$1 AND row_hash=$6) RETURNING id',[a.id,r.label,null,a.source_url,r.raw,rowHash]);inserted+=q.rowCount||0;}
  const audit=await db.query('INSERT INTO gis_artifact_parse_audits(artifact_id,parser_version,artifact_sha256,records_extracted,errors,status,notes) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id',[a.id,PARSER_VERSION,a.sha256,states.length,JSON.stringify(errors),'PARSED','Parsed only records actually present in the stored INEC HTML artifact; dependent selectors were recorded as zero when absent. No candidate status mutation.']);
  return res.status(201).json({...evidence,rows_inserted:inserted,parse_audit_id:audit.rows[0].id,parse_status:'PARSED',artifact_verification_status_unchanged:a.verification_status,policy:'Parsing is append-only, deterministic, fail-closed on malformed/untrusted content, and does not alter candidate statuses.'});
}