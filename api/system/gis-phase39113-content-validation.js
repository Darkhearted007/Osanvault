import { db } from 'hatchable';
export const access='admin';
export const methods=['POST'];
const SOURCE='INEC-POLLING-UNIT-LOCATOR-2026';
const sha=async s=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))].map(x=>x.toString(16).padStart(2,'0')).join('');
const norm=s=>String(s||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
function parseOptions(json){if(!Array.isArray(json)||!json[0]||typeof json[0]!=='object')return null;return Object.entries(json[0]).filter(([k])=>k!=='0'&&k!=='selected').map(([id,name])=>({id:Number(id),name:String(name)}));}
export default async function(req,res){
 const only=req.body?.candidate_id;
 const candidates=only?(await db.query("SELECT id,state_name,lga_name,candidate_area_code,status FROM gis_exception_candidate_matches WHERE id=$1 AND status='CANDIDATE_ONLY'",[only])).rows:(await db.query("SELECT id,state_name,lga_name,candidate_area_code,status FROM gis_exception_candidate_matches WHERE status='CANDIDATE_ONLY' ORDER BY state_name,lga_name")).rows;
 if(only&&!candidates.length)return res.status(404).json({phase:'391.13',error:'candidate_not_found_or_not_candidate_only',candidate_mutation:false,production_gate:'NOT_READY'});
 const canonical=(await db.query("SELECT source_key,source_registry_id,source_url,authority_level FROM gis_canonical_source_identity WHERE source_key=$1 LIMIT 1",[SOURCE])).rows[0];
 if(!canonical)return res.status(409).json({phase:'391.13',error:'canonical_source_unavailable',candidate_mutation:false,production_gate:'NOT_READY'});
 const run=(await db.query("INSERT INTO gis_inec_content_validation_runs(phase,canonical_source_key,artifact_scope,candidate_count) VALUES($1,$2,$3,$4) RETURNING id",['391.13',SOURCE,'stored_inec_live_api_snapshots',candidates.length])).rows[0];
 let confirmed=0,insufficient=0,conflict=0,unverified=0,validated=0; const decisions=[];
 for(const c of candidates){
   const cw=(await db.query('SELECT state_id,lga_id,official_lga_name,official_ward_count,lga_snapshot_id,ward_snapshot_id,match_status FROM inec_candidate_live_crosswalks WHERE candidate_match_id=$1',[c.id])).rows[0];
   let decision='EVIDENCE_UNVERIFIED',errors=[];let content={};
   if(!cw){errors=['No stored INEC live crosswalk exists for this candidate.'];}
   else {
     const ws=(await db.query('SELECT id,canonical_source_key,endpoint_path,request_query,http_status,content_type,byte_size,response_sha256,response_json,acquisition_status,provenance_status,acquired_at FROM inec_live_api_snapshots WHERE id=$1',[cw.ward_snapshot_id])).rows[0];
     const ls=(await db.query('SELECT id,canonical_source_key,endpoint_path,request_query,http_status,content_type,byte_size,response_sha256,response_json,acquisition_status,provenance_status,acquired_at FROM inec_live_api_snapshots WHERE id=$1',[cw.lga_snapshot_id])).rows[0];
     if(!ws||!ls)errors=['Required stored INEC State/LGA/Ward snapshots are missing.'];
     else if(ws.canonical_source_key!==SOURCE||ls.canonical_source_key!==SOURCE)errors=['Stored snapshot canonical source does not match the canonical INEC source.'];
     else if(ws.http_status!==200||ls.http_status!==200)errors=['Stored INEC snapshot did not return HTTP 200.'];
     else if(!String(ws.content_type||'').toLowerCase().includes('json')||!String(ls.content_type||'').toLowerCase().includes('json'))errors=['Stored INEC snapshot content type is not JSON.'];
     else if(ws.acquisition_status!=='ACQUIRED'||ls.acquisition_status!=='ACQUIRED')errors=['Stored INEC snapshot acquisition status is not ACQUIRED.'];
     else if(!ws.response_sha256||!ls.response_sha256)errors=['Stored INEC snapshot SHA-256 is missing.'];
     else {
       const wards=parseOptions(ws.response_json); const lgas=parseOptions(ls.response_json);
       if(!wards||!lgas)errors=['Stored INEC response shape is malformed or does not contain an options object.'];
       else if(!wards.length)errors=['Stored INEC Ward response contains no ward records.'];
       else {
         const lgaMatch=lgas.find(x=>Number(x.id)===Number(cw.lga_id));
         const names=wards.map(x=>x.name.trim()).filter(Boolean);
         const duplicateNames=names.filter((n,i)=>names.indexOf(n)!==i);
         if(!lgaMatch)errors.push('Stored INEC LGA response does not contain the crosswalk LGA id.');
         if(duplicateNames.length)errors.push('Stored INEC Ward response contains duplicate ward labels.');
         if(errors.length===0){decision='EVIDENCE_CONFIRMED';confirmed++;validated++;}
         else {decision='EVIDENCE_INSUFFICIENT';insufficient++;validated++;}
         content={state_id:cw.state_id,lga_id:cw.lga_id,official_lga_name:cw.official_lga_name,official_ward_count:cw.official_ward_count,stored_lga_snapshot_id:ls.id,stored_lga_sha256:ls.response_sha256,stored_ward_snapshot_id:ws.id,stored_ward_sha256:ws.response_sha256,ward_record_count:wards.length,ward_labels:wards.map(x=>({id:x.id,name:x.name})),lga_record_present:!!lgaMatch,duplicate_ward_labels:duplicateNames};
       }
     }
   }
   if(decision==='EVIDENCE_UNVERIFIED')unverified++;
   const fingerprint=await sha(JSON.stringify({candidate_id:c.id,canonical_source_key:SOURCE,decision,content,errors,candidate_status:c.status}));
   const ins=await db.query('INSERT INTO gis_inec_content_validation_decisions(run_id,candidate_match_id,lga_snapshot_id,ward_snapshot_id,state_id,lga_id,artifact_sha256,canonical_source_key,evidence_decision,content_validation,errors,decision_fingerprint,candidate_status_before,candidate_mutation) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,false) ON CONFLICT(decision_fingerprint) DO NOTHING RETURNING id,validated_at',[run.id,c.id,cw?.lga_snapshot_id||null,cw?.ward_snapshot_id||null,cw?.state_id||null,cw?.lga_id||null,content.stored_ward_sha256||null,SOURCE,decision,JSON.stringify(content),JSON.stringify(errors),fingerprint,c.status]);
   decisions.push({candidate_id:c.id,state_name:c.state_name,lga_name:c.lga_name,candidate_area_code:c.candidate_area_code,candidate_status:c.status,evidence_decision:decision,content_validation:content,errors,audit_id:ins.rows[0]?.id||null,candidate_mutation:false});
 }
 const finalStatus=(confirmed===candidates.length&&candidates.length>0)?'COMPLETE':'COMPLETE_WITH_HOLDS';
 await db.query('UPDATE gis_inec_content_validation_runs SET validated_count=$1,confirmed_count=$2,insufficient_count=$3,conflict_count=$4,unverified_count=$5,status=$6,completed_at=now() WHERE id=$7',[validated,confirmed,insufficient,conflict,unverified,finalStatus,run.id]);
 res.status(200).json({phase:'391.13',run_id:run.id,canonical_source:canonical,validation_timestamp:new Date().toISOString(),candidate_count:candidates.length,validated_count:validated,confirmed_count:confirmed,insufficient_count:insufficient,conflict_count:conflict,unverified_count:unverified,decisions,production_gate:'NOT_READY',candidate_status_mutations:0,policy:'Stored INEC live API responses are validated as evidence only. No candidate is promoted, no external source is substituted, and all decisions are append-only.'});
}