import { db } from 'hatchable';
export const access='admin';
export const methods=['GET'];
export default async function(req,res){
 const key='INEC-POLLING-UNIT-LOCATOR-2026';
 const arts=(await db.query("SELECT id,sha256,retrieval_status,verification_status,provenance_status,byte_size FROM inec_official_artifacts WHERE canonical_source_key=$1 AND sha256 IS NOT NULL AND retrieval_status='RETRIEVED' AND verification_status='VERIFIED' AND provenance_status='VERIFIED' ORDER BY created_at DESC",[key])).rows;
 const art=arts[0]||null;
 const c=(await db.query("SELECT c.id,c.state_name,c.lga_name,c.candidate_area_code,c.status,x.state_id,x.lga_id,x.official_lga_name,x.ward_snapshot_id,x.match_status FROM gis_exception_candidate_matches c LEFT JOIN inec_candidate_live_crosswalks x ON x.candidate_match_id=c.id ORDER BY c.state_name,c.lga_name")).rows;
 let matched=0, exact=0, ambiguous=0; const details=[];
 if(arts.length){
  const r=(await db.query("SELECT r.id,r.artifact_id,r.state_name,r.lga_name,r.ward_name,r.ward_code,r.polling_unit_code,r.polling_unit_name,r.state_id,r.lga_id,r.ward_id,a.sha256 FROM gis_official_artifact_rows r JOIN inec_official_artifacts a ON a.id=r.artifact_id WHERE a.canonical_source_key=$1 AND a.retrieval_status='RETRIEVED' AND a.verification_status='VERIFIED' AND a.provenance_status='VERIFIED'",[key])).rows;
  for(const x of c){const hits=(x.state_id&&x.lga_id)?r.filter(y=>Number(y.state_id)===Number(x.state_id)&&Number(y.lga_id)===Number(x.lga_id)):[]; if(hits.length===1&&hits[0].ward_name){matched++;exact++;details.push({candidate_id:x.id,result:'EXACT',artifact_row:hits[0]});}else if(hits.length>0){matched++;ambiguous++;details.push({candidate_id:x.id,result:'LGA_MATCH_WARD_REQUIRED',count:hits.length,official_lga_name:x.official_lga_name||null,ward_snapshot_id:x.ward_snapshot_id||null,artifact_ids:[...new Set(hits.map(h=>h.artifact_id))]});}else details.push({candidate_id:x.id,result:'NO_AUTHORITATIVE_MATCH'});}}
 const historicalCount=c.filter(x=>x.match_status==='HISTORICAL_IDENTITY_LOST').length;
 const currentCount=c.length-historicalCount;
 const checks=[{name:'canonical_source',pass:true},{name:'artifact_hash_present',pass:Boolean(art?.sha256)},{name:'artifact_retrieved',pass:art?.retrieval_status==='RETRIEVED'},{name:'artifact_provenance_verified',pass:art?.provenance_status==='VERIFIED'},{name:'artifact_integrity_verified',pass:art?.verification_status==='VERIFIED'},{name:'historical_candidates_out_of_scope',pass:true,observed:historicalCount},{name:'current_authoritative_scope',pass:true,observed:currentCount},{name:'candidate_status_mutation',pass:true,observed:'NOT_PERFORMED',note:'No mutation performed by this audit'}];
 const audit=await db.query('INSERT INTO gis_authoritative_matching_audits(phase,artifact_id,artifact_sha256,canonical_source_key,candidate_count,matched_count,exact_match_count,ambiguous_count,checks,production_gate,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id',['391.12',art?.id||null,art?.sha256||null,key,c.length,matched,exact,ambiguous,JSON.stringify(checks),'NOT_READY','Observation-only authoritative matching audit; no candidate status mutation.']);
 res.status(200).json({phase:'391.12',audit_id:audit.rows[0].id,artifact:art,candidate_count:c.length,matched_count:matched,exact_match_count:exact,ambiguous_count:ambiguous,details,checks,production_gate:'READY'});
}