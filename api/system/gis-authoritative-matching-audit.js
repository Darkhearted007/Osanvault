import { db } from 'hatchable';
export const access='admin';
export const methods=['GET'];
export default async function(req,res){
 const key='INEC-POLLING-UNIT-LOCATOR-2026';
 const art=(await db.query("SELECT id,sha256,retrieval_status,verification_status,provenance_status,byte_size FROM inec_official_artifacts WHERE canonical_source_key=$1 AND sha256 IS NOT NULL ORDER BY created_at DESC LIMIT 1",[key])).rows[0]||null;
 const c=(await db.query("SELECT id,state_name,lga_name,candidate_area_code,status FROM gis_exception_candidate_matches ORDER BY state_name,lga_name")).rows;
 let matched=0, exact=0, ambiguous=0; const details=[];
 if(art){
  const r=(await db.query("SELECT state_name,lga_name,ward_name,ward_code,polling_unit_code,polling_unit_name FROM gis_official_artifact_rows WHERE artifact_id=$1",[art.id])).rows;
  for(const x of c){const hits=r.filter(y=>y.state_name&&y.lga_name&&x.state_name&&x.lga_name&&y.state_name.toLowerCase().replace(/^\\d+\\s*-\\s*/,'').trim()===x.state_name.toLowerCase().trim()&&y.lga_name.toLowerCase().trim()===x.lga_name.toLowerCase().trim()); if(hits.length===1){matched++;exact++;details.push({candidate_id:x.id,result:'EXACT',artifact_row:hits[0]});}else if(hits.length>1){matched++;ambiguous++;details.push({candidate_id:x.id,result:'AMBIGUOUS',count:hits.length});}else details.push({candidate_id:x.id,result:'NO_AUTHORITATIVE_MATCH'});}}
 const checks=[{name:'canonical_source',pass:true},{name:'artifact_hash_present',pass:Boolean(art?.sha256)},{name:'artifact_retrieved',pass:art?.retrieval_status==='RETRIEVED'},{name:'artifact_provenance_verified',pass:art?.provenance_status==='VERIFIED'},{name:'artifact_integrity_verified',pass:art?.verification_status==='VERIFIED'},{name:'candidate_preservation',pass:c.length===30},{name:'candidate_status_mutation',pass:false,note:'No mutation performed by this audit'}];
 const audit=await db.query('INSERT INTO gis_authoritative_matching_audits(phase,artifact_id,artifact_sha256,canonical_source_key,candidate_count,matched_count,exact_match_count,ambiguous_count,checks,production_gate,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id',['391.12',art?.id||null,art?.sha256||null,key,c.length,matched,exact,ambiguous,JSON.stringify(checks),'NOT_READY','Observation-only authoritative matching audit; no candidate status mutation.']);
 res.status(200).json({phase:'391.12',audit_id:audit.rows[0].id,artifact:art,candidate_count:c.length,matched_count:matched,exact_match_count:exact,ambiguous_count:ambiguous,details,checks,production_gate:'NOT_READY'});
}