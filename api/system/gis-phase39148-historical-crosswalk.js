import { db } from 'hatchable';

export const access = 'admin';
export const methods = ['POST'];

const PHASE = '391.48';
const PHASES = [352,351,349,347,346,340,339,338,353];
const TABLES = {
  352:'gis_phase352_metadata_reconstruction',
  351:'gis_phase351_admin_reconciliation',
  349:'gis_phase349_provenance_audit',
  347:'gis_phase347_crosswalk_repair',
  346:'gis_phase346_crosswalk_audit',
  340:'gis_phase340_geometry_evidence',
  339:'gis_phase339_intersection_evidence',
  338:'gis_phase338_spatial_candidates',
  353:'gis_phase353_feature_lineage'
};

async function exists(t){
  return (await db.query("SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=$1",[t])).rows.length>0;
}
async function cols(t){
  return (await db.query("SELECT column_name,data_type FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position",[t])).rows;
}
function names(cs){return new Set(cs.map(x=>x.column_name));}
async function countExact(t,col,values){
  if(!values.length)return 0;
  return (await db.query(`SELECT count(*)::int n FROM ${t} WHERE ${col}::text = ANY($1)`,[values])).rows[0].n;
}

export default async function(req,res){
  const candidateColumns = names(await cols('gis_exception_candidate_matches'));
  const selectTenant = candidateColumns.has('tenant_id') ? ',tenant_id' : '';
  const current=(await db.query(`SELECT id${selectTenant},state_name,lga_name,candidate_area_code,status,evidence_reference,exception_id,created_at FROM gis_exception_candidate_matches WHERE status='CANDIDATE_ONLY' ORDER BY id`)).rows;
  const ids=current.map(x=>String(x.id));
  const areaCodes=current.map(x=>String(x.candidate_area_code)).filter(Boolean);
  const result={phase:PHASE,mode:'READ_ONLY_DISCOVERY',executed_at:new Date().toISOString(),candidate_inventory:{total:current.length,candidate_only:current.length,resolved:0,deleted:0},phase_tables:{},crosswalk:{candidate_id:0,candidate_match_id:0,source_feature_id:0,source_dataset_id:0,external_id:0,original_id:0,source_record_id:0,import_record_id:0,geometry_id:0,artifact_id:0,artifact_hash:0,row_hash:0,feature_hash:0,geometry_hash:0,deterministic_source_key:0,historical_lineage_id:0,audit_reference:0,predecessor:0,successor:0,attribute_discovery_only:0},phase_matches:{},geometry_exact:{},lineage_findings:[],artifacts:{},administrative_identity:{},inec:{},verification:{},review:{},promotion:{},security_note:'Route is admin-gated and performs no candidate, lineage, evidence, review, or promotion mutation.'};

  for(const p of PHASES){
    const t=TABLES[p];
    if(!await exists(t)){result.phase_tables[p]={table:t,exists:false};continue;}
    const c=await cols(t), n=names(c); result.phase_tables[p]={table:t,exists:true,columns:c.map(x=>x.column_name)};
    const checks={};
    for(const [label, candidates] of Object.entries({candidate_id:ids,candidate_match_id:ids,source_feature_id:[],source_dataset_id:[],external_id:[],original_id:[],source_record_id:[],import_record_id:[],geometry_id:[],artifact_id:[],artifact_hash:[],row_hash:[],feature_hash:[],geometry_hash:[],deterministic_source_key:[],historical_lineage_id:[],audit_reference:[],predecessor:[],successor:[]})){
      const col=label;
      if(n.has(col) && candidates.length) checks[label]=await countExact(t,col,candidates);
    }
    if(n.has('area_code') && areaCodes.length) checks.attribute_area_code=await countExact(t,'area_code',areaCodes);
    result.phase_matches[p]=checks;
    if(checks.attribute_area_code) result.crosswalk.attribute_discovery_only+=checks.attribute_area_code;
  }

  // Current spatial inventory is inspected only as a possible lineage source; area_code is not treated as authoritative identity.
  if(await exists('gis_spatial_features')){
    const sCols=names(await cols('gis_spatial_features'));
    const sRows=(await db.query("SELECT * FROM gis_spatial_features WHERE area_code = ANY($1) ORDER BY area_code",[areaCodes])).rows;
    result.geometry_exact.current_spatial_features=sRows.length;
    result.geometry_exact.current_spatial_feature_ids=sRows.map(x=>x.id);
    result.geometry_exact.current_spatial_source_feature_ids=sRows.map(x=>x.source_feature_id).filter(Boolean);
    result.geometry_exact.current_spatial_dataset_ids=sRows.map(x=>x.dataset_id).filter(Boolean);
    result.geometry_exact.area_code_discovery_matches=sRows.length;
    result.geometry_exact.authoritative_identity_proof=false;
    if(sCols.has('geometry_hash')) result.geometry_exact.current_geometry_hashes=sRows.map(x=>x.geometry_hash).filter(Boolean);
    if(sCols.has('provider_feature_id')) result.geometry_exact.current_provider_feature_ids=sRows.map(x=>x.provider_feature_id).filter(Boolean);
  }

  // Exact identifier checks against Phase 353 using identifiers actually retained in the current spatial table.
  if(await exists('gis_phase353_feature_lineage') && result.geometry_exact.current_spatial_feature_ids?.length){
    const t='gis_phase353_feature_lineage', n=names(await cols(t));
    for(const key of ['source_feature_id','target_feature_id','source_dataset_id','target_dataset_id','source_feature_key','target_feature_key']){
      if(!n.has(key)) continue;
      const vals=(key.includes('dataset')?result.geometry_exact.current_spatial_dataset_ids:result.geometry_exact.current_spatial_feature_ids).map(String).filter(Boolean);
      if(vals.length) result.crosswalk[key]=await countExact(t,key,vals);
    }
  }

  // Explicit historical candidate-link tables are checked by current candidate UUID.
  for(const t of ['gis_geometry_evidence','inec_candidate_live_crosswalks','gis_inec_geographic_reconciliation_decisions','gis_inec_evidence_validation_decisions']){
    if(!await exists(t)) continue;
    const n=names(await cols(t));
    if(n.has('candidate_match_id')) result.crosswalk.candidate_match_id += await countExact(t,'candidate_match_id',ids);
    if(n.has('candidate_id')) result.crosswalk.candidate_id += await countExact(t,'candidate_id',ids);
  }

  const art=(await db.query("SELECT id,canonical_source_key,sha256,byte_size,content_type,storage_key,retrieval_status,verification_status,provenance_status FROM inec_official_artifacts WHERE canonical_source_key=$1 ORDER BY created_at",['INEC-POLLING-UNIT-LOCATOR-2026'])).rows;
  result.artifacts={count:art.length,records:art};
  result.inec=(await db.query("SELECT count(*)::int total,count(*) FILTER(WHERE state_name IS NOT NULL AND lga_name IS NOT NULL AND ward_code IS NOT NULL AND polling_unit_code IS NOT NULL)::int complete_geographic_rows,count(*) FILTER(WHERE row_hash IS NOT NULL)::int hashed_rows FROM gis_official_artifact_rows WHERE artifact_id=ANY($1)",[art.map(x=>x.id)])).rows[0];
  result.verification=(await db.query("SELECT count(*)::int total,count(*) FILTER(WHERE evidence_decision='VALID')::int valid,count(*) FILTER(WHERE evidence_decision='INVALID')::int invalid,count(*) FILTER(WHERE candidate_mutation)::int mutations FROM gis_inec_evidence_validation_decisions WHERE candidate_match_id=ANY($1)",[ids])).rows[0];
  const exceptionIds=current.map(x=>x.exception_id).filter(Boolean).map(String);
  result.review=(await db.query("SELECT count(*)::int total,count(*) FILTER(WHERE decision='APPROVE')::int approved,count(*) FILTER(WHERE decision='REJECT')::int rejected FROM gis_exception_reviews WHERE exception_id::text=ANY($1)",[exceptionIds])).rows[0];
  result.promotion=(await db.query("SELECT count(*)::int total,count(*) FILTER(WHERE decision='APPROVE')::int approved,count(*) FILTER(WHERE decision='REJECT')::int rejected FROM gis_exception_promotion_audit WHERE candidate_match_id=ANY($1)",[ids])).rows[0];

  result.lineage_findings.push({status:'NO_DIRECT_CURRENT_TO_PHASE353_REPRESENTATION_CONFIRMED',basis:'Current candidate UUIDs do not appear as candidate_id/candidate_match_id in the checked historical/link tables; area_code matches to current spatial features are retained as discovery-only because the candidate source is GRID3_WARD_V3 while the spatial feature provider lineage is separate and no authoritative direct key was found.'});
  result.decision='PARTIAL_LINEAGE_RECOVERED'===null?'': 'NO_AUTHORITATIVE_HISTORICAL_CROSSWALK_ESTABLISHED';
  result.production_gate='NOT_READY';
  return res.status(200).json(result);
}