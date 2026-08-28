import { db, storage } from 'hatchable';
export const access='admin'; export const methods=['POST'];
const PARSER_VERSION='391.29.2';
async function hashBytes(buf){const d=await crypto.subtle.digest('SHA-256',buf);return Array.from(new Uint8Array(d)).map(x=>x.toString(16).padStart(2,'0')).join('');}
function clean(s){return String(s||'').replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim()}
function responsePollingUnits(responseJson){
  if(!Array.isArray(responseJson)) return [];
  const obj=responseJson.find(x=>x&&typeof x==='object'&&!Array.isArray(x))||{};
  return Object.entries(obj).filter(([k,v])=>k!=='selected'&&k!=='0'&&/^\d+$/.test(k)&&v!=null&&String(v).trim()).map(([id,name])=>({polling_unit_id:Number(id),polling_unit_name:String(name)}));
}
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
  const a=(await db.query('SELECT id,source_registry_id,canonical_source_key,sha256,retrieval_status,verification_status,provenance_status,storage_key,source_url,content_type,byte_size,artifact_type FROM inec_official_artifacts WHERE id=$1 LIMIT 1',[String(artifactId)])).rows[0];
  if(!a)return res.status(404).json({error:'artifact not found'});
  const eligible=a.canonical_source_key==='INEC-POLLING-UNIT-LOCATOR-2026'&&a.retrieval_status==='RETRIEVED'&&!!a.sha256&&(a.provenance_status==='SOURCE_BOUND_AND_HASH_VERIFIED'||a.provenance_status==='VERIFIED')&&(a.verification_status==='PENDING_CONTENT_VALIDATION'||a.verification_status==='VERIFIED');
  if(!eligible)return res.status(409).json({error:'artifact is not eligible for deterministic parsing',decision:'PARSE_BLOCKED_ARTIFACT_NOT_FULLY_VERIFIED',candidate_mutation:false});
  let s;try{s=await storage.get(a.storage_key)}catch(e){return res.status(422).json({error:'stored artifact unavailable',decision:'PARSE_BLOCKED_STORAGE_UNAVAILABLE',detail:String(e),candidate_mutation:false});}
  if(!s?.buffer?.length)return res.status(422).json({error:'stored artifact is empty',decision:'PARSE_BLOCKED_EMPTY_ARTIFACT',candidate_mutation:false});
  const actual=await hashBytes(s.buffer);
  if(actual!==a.sha256)return res.status(409).json({error:'stored artifact hash mismatch',decision:'PARSE_BLOCKED_HASH_MISMATCH',recorded_sha256:a.sha256,computed_sha256:actual,candidate_mutation:false});
  if(Number.isFinite(Number(a.byte_size))&&Number(a.byte_size)!==s.buffer.byteLength)return res.status(409).json({error:'stored artifact byte-size mismatch',decision:'PARSE_BLOCKED_BYTE_SIZE_MISMATCH',recorded_byte_size:Number(a.byte_size),computed_byte_size:s.buffer.byteLength,candidate_mutation:false});
  let html;try{html=new TextDecoder('utf-8',{fatal:true}).decode(s.buffer)}catch(e){return res.status(422).json({error:'stored artifact is not valid UTF-8',decision:'PARSE_BLOCKED_ENCODING',candidate_mutation:false});}
  const isApiBundle=String(a.content_type||'').toLowerCase().startsWith('application/json')&&(a.artifact_type==='official INEC machine-readable polling-unit API response bundle'||a.artifact_type==='official machine-readable polling-unit API response bundle');
  if(isApiBundle){
    let bundle;try{bundle=JSON.parse(html)}catch(e){return res.status(422).json({error:'stored API bundle is invalid JSON',decision:'PARSE_BLOCKED_JSON',candidate_mutation:false});}
    if(bundle?.schema_version!=='391.29.1'||bundle?.canonical_source_key!=='INEC-POLLING-UNIT-LOCATOR-2026'||!Array.isArray(bundle.entries))return res.status(422).json({error:'stored API bundle failed schema/provenance signature',decision:'PARSE_BLOCKED_BUNDLE_SCHEMA',candidate_mutation:false});
    const errors=[];let inserted=0,extracted=0;const rows=[];for(const r of bundle.entries){
      const pus=responsePollingUnits(r.response_json); extracted+=pus.length;
      if(!r.state_id||!r.lga_id||!r.ward_id||!r.ward_name||!pus.length){errors.push({code:'NO_POLLING_UNIT_RECORDS_IN_RESPONSE',state_id:r.state_id,lga_id:r.lga_id,ward_id:r.ward_id});continue;}
      for(const pu of pus){
        const rowHash=await hashBytes(new TextEncoder().encode(JSON.stringify({artifact_id:a.id,state_id:r.state_id,lga_id:r.lga_id,ward_id:r.ward_id,polling_unit_id:pu.polling_unit_id,polling_unit_name:pu.polling_unit_name,response_sha256:r.response_sha256})));
        rows.push({state_name:null,lga_name:null,ward_name:r.ward_name,ward_code:String(r.ward_id),polling_unit_name:pu.polling_unit_name,source_page:r.endpoint_path||'',raw_text:JSON.stringify({state_id:r.state_id,lga_id:r.lga_id,ward_id:r.ward_id,ward_name:r.ward_name,polling_unit_id:pu.polling_unit_id,polling_unit_name:pu.polling_unit_name,response_sha256:r.response_sha256}),row_hash:rowHash,state_id:r.state_id,lga_id:r.lga_id,ward_id:r.ward_id,polling_unit_id:pu.polling_unit_id,response_sha256:r.response_sha256});
      }
    }
    for(let i=0;i<rows.length;i+=500){const chunk=rows.slice(i,i+500);const q=await db.query('INSERT INTO gis_official_artifact_rows(artifact_id,state_name,lga_name,ward_name,ward_code,polling_unit_name,source_page,raw_text,row_hash,state_id,lga_id,ward_id,polling_unit_id,response_sha256) SELECT $1,x.state_name,x.lga_name,x.ward_name,x.ward_code,x.polling_unit_name,x.source_page,x.raw_text,x.row_hash,x.state_id,x.lga_id,x.ward_id,x.polling_unit_id,x.response_sha256 FROM jsonb_to_recordset($2::jsonb) x(state_name text,lga_name text,ward_name text,ward_code text,polling_unit_name text,source_page text,raw_text text,row_hash text,state_id integer,lga_id integer,ward_id integer,polling_unit_id integer,response_sha256 text) WHERE NOT EXISTS (SELECT 1 FROM gis_official_artifact_rows z WHERE z.artifact_id=$1 AND z.row_hash=x.row_hash)',[a.id,JSON.stringify(chunk)]);inserted+=q.rowCount||0;}
    const parsedAt=new Date().toISOString();const evidence={artifact_id:a.id,artifact_id_type:'uuid',source_registry_id:a.source_registry_id,canonical_source_key:a.canonical_source_key,provenance_reference:{source_registry_id:a.source_registry_id,source_url:a.source_url,canonical_source_url:bundle.canonical_source_url,transport_base:bundle.transport_base},artifact_sha256:a.sha256,parser_version:PARSER_VERSION,parse_timestamp:parsedAt,stored_byte_size:s.buffer.byteLength,record_count:extracted,selector_counts:{ward_response_entries:bundle.entries.length,polling_unit_records:extracted,source_snapshots:bundle.source_snapshot_count||0},errors,extraction_mode:'deterministic JSON API response-bundle extraction',candidate_mutation:false,authoritative_evidence_ready:true};
    const audit=await db.query('INSERT INTO gis_artifact_parse_audits(artifact_id,parser_version,artifact_sha256,records_extracted,errors,status,notes) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id',[a.id,PARSER_VERSION,a.sha256,extracted,JSON.stringify(errors),'PARSED','Parsed actual official INEC API response bundle into append-only artifact rows. Candidate statuses were not mutated.']);
    return res.status(201).json({...evidence,rows_inserted:inserted,parse_audit_id:audit.rows[0].id,parse_status:'PARSED',artifact_verification_status_unchanged:a.verification_status,policy:'Parsing is append-only, deterministic and source-bound. API bundle rows are derived only from actual retained official INEC responses and never resolve candidate status.'});
  }
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
  const selectorCounts={states:states.length,local_governments:lgas?.length??0,registration_areas:regAreas?.length??0,polling_units:pus?.length??0};
  const structureOnly=selectorCounts.local_governments===0&&selectorCounts.registration_areas===0&&selectorCounts.polling_units===0;
  const evidence={artifact_id:a.id,artifact_id_type:'uuid',source_registry_id:a.source_registry_id,canonical_source_key:a.canonical_source_key,provenance_reference:{source_registry_id:a.source_registry_id,source_url:a.source_url},artifact_sha256:a.sha256,parser_version:PARSER_VERSION,parse_timestamp:parsedAt,stored_byte_size:s.buffer.byteLength,record_count:structureOnly?0:pus.length,selector_counts:selectorCounts,errors,extraction_mode:structureOnly?'deterministic HTML locator-structure extraction (state reference options only)':'deterministic HTML select-option extraction',candidate_mutation:false,authoritative_evidence_ready:!structureOnly};
  let inserted=0;
  if(!structureOnly){for(const r of pus){const rowHash=await hashBytes(new TextEncoder().encode(JSON.stringify({artifact_id:a.id,polling_unit_code:r.value,polling_unit_name:r.label,source_url:a.source_url,raw:r.raw})));const q=await db.query('INSERT INTO gis_official_artifact_rows(artifact_id,state_name,polling_unit_name,source_page,raw_text,row_hash) SELECT $1,$2,$3,$4,$5,$6 WHERE NOT EXISTS (SELECT 1 FROM gis_official_artifact_rows WHERE artifact_id=$1 AND row_hash=$6) RETURNING id',[a.id,null,r.label,a.source_url,r.raw,rowHash]);inserted+=q.rowCount||0;}}
  const parseStatus=structureOnly?'PARSED_STRUCTURE_ONLY':'PARSED';
  const audit=await db.query('INSERT INTO gis_artifact_parse_audits(artifact_id,parser_version,artifact_sha256,records_extracted,errors,status,notes) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id',[a.id,PARSER_VERSION,a.sha256,evidence.record_count,JSON.stringify(errors),parseStatus,structureOnly?'Artifact is the official locator HTML shell; it contains state reference options but no LGA, registration-area, or polling-unit records. It is not sufficient as candidate-level authoritative evidence. No candidate status mutation.':'Parsed polling-unit records actually present in the stored artifact. No candidate status mutation.']);
  return res.status(201).json({...evidence,rows_inserted:inserted,parse_audit_id:audit.rows[0].id,parse_status:parseStatus,artifact_verification_status_unchanged:a.verification_status,policy:'Parsing is append-only, deterministic, fail-closed on malformed/untrusted content, and does not alter candidate statuses.'});
}