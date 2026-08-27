import { db } from 'hatchable';
export const access='admin';
export const methods=['GET'];
const tables=['gis_exception_candidate_matches','gis_canonical_source_identity','inec_official_artifacts','economic_evidence_vault','systemwide_readiness_audits'];
export default async function(req,res){
 const observations=[]; const contradictions=[];
 let database_name=null; let schema_name='public';
 try{const ident=(await db.query('SELECT current_database() AS database_name,current_schema() AS schema_name')).rows[0]; database_name=ident?.database_name||null; schema_name=ident?.schema_name||'public';}catch(e){contradictions.push({check:'database_identity',error:String(e?.message||e)});}
 for(const table of tables){
  try{
   const exists=(await db.query("SELECT COUNT(*)::int AS n FROM information_schema.tables WHERE table_schema=$1 AND table_name=$2",[schema_name,table])).rows[0].n;
   let rowCount=null;
   if(exists===1) rowCount=(await db.query(`SELECT COUNT(*)::int AS n FROM ${schema_name}.${table}`)).rows[0].n;
   observations.push({table,schema:schema_name,exists:exists===1,rowCount});
  }catch(e){observations.push({table,exists:false,rowCount:null,error:String(e?.message||e)});contradictions.push({check:'table_probe',table,error:String(e?.message||e)});}
 }
 const missing=observations.filter(x=>!x.exists); if(missing.length) contradictions.push({check:'expected_tables_visible',missing:missing.map(x=>x.table)});
 const candidate=observations.find(x=>x.table==='gis_exception_candidate_matches');
 if(candidate?.exists && candidate.rowCount!==30) contradictions.push({check:'candidate_preservation',expected:30,observed:candidate.rowCount});
 const source=observations.find(x=>x.table==='gis_canonical_source_identity');
 if(source?.exists){try{const r=await db.query(`SELECT COUNT(*)::int AS n FROM ${schema_name}.gis_canonical_source_identity WHERE source_key=$1`,['INEC-POLLING-UNIT-LOCATOR-2026']);if(r.rows[0].n!==1) contradictions.push({check:'canonical_source_identity',expected:1,observed:r.rows[0].n});}catch(e){contradictions.push({check:'canonical_source_identity_probe',error:String(e?.message||e)});}}
 const decision=contradictions.length?'NOT_RECONCILED':'RECONCILED';
 const r=await db.query(`INSERT INTO ${schema_name}.runtime_data_plane_reconciliation_runs(phase,database_name,schema_name,table_observations,contradictions,decision,notes) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id`,['391.2',database_name,schema_name,JSON.stringify(observations),JSON.stringify(contradictions),decision,'Observation-only reconciliation; no schema replay, no candidate mutation, no synthetic data.']);
 res.status(contradictions.length?409:200).json({phase:'391.2',runId:r.rows[0].id,database_name,observations,contradictions,decision,production_gate:'NOT_READY'});
}