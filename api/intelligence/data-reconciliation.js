import { db } from 'hatchable';
export const access='member';
export const methods=['GET'];
export default async function(req,res){
 const owner=req.member.id;
 const tables=['economic_onboarding_profiles','economic_evidence_vault','economic_trusted_evidence_signals','economic_trusted_signal_aggregates','economic_intelligence_provenance','economic_explainable_network_intelligence','economic_explainable_assessments','economic_explainable_consensus','economic_explainable_decisions'];
 const checks=[];
 for(const table of tables){const r=await db.query(`SELECT to_regclass($1) AS table_name`,[`public.${table}`]);checks.push({table,exists:Boolean(r.rows[0]?.table_name)});}
 const missing=checks.filter(x=>!x.exists).map(x=>x.table);
 const p=await db.query(`SELECT id,display_name,business_type,sector,data_environment,onboarding_status FROM economic_onboarding_profiles WHERE owner_id=$1 ORDER BY created_at DESC`,[owner]);
 res.json({ok:missing.length===0,canonicalSchema:missing.length===0,missingTables:missing,checks,ownedProductionProfiles:p.rows,publicExposure:false,productionDataSeeded:false,next:missing.length?'schema_repair':'real_evidence_intake'});
}