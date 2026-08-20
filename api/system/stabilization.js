import { db } from 'hatchable';
export const access='member';
export const methods=['GET','POST'];

async function check(name,fn){try{return {name,status:'ok',details:await fn()};}catch(e){return {name,status:'failed',error:String(e?.message||e)}}}

async function runChecks(){
 const checks=[];
 checks.push(await check('database',async()=>{const r=await db.query('SELECT 1 AS ok');return r.rows[0].ok===1?'reachable':'unexpected_result'}));
 checks.push(await check('core_schema',async()=>{const names=['economic_onboarding_profiles','economic_graph_relationships','economic_evidence_vault','graph_assessments','economic_network_feedback_runs','economic_consensus_reconciliation_runs','economic_consensus_conflicts','platform_stabilization_runs'];const checks=await Promise.all(names.map(async name=>{const r=await db.query(`SELECT COUNT(*)::int AS found FROM information_schema.tables WHERE table_schema='public' AND table_name=$1`,[name]);return {name,exists:Number(r.rows[0]?.found||0)>0}}));const missing=checks.filter(x=>!x.exists).map(x=>x.name);if(missing.length)throw new Error('missing tables: '+missing.join(', '));return {tables:names.length,verified:checks.map(x=>x.name)}}));
 checks.push(await check('onboarding_data_integrity',async()=>{const r=await db.query(`SELECT (SELECT COUNT(*) FROM economic_onboarding_profiles) AS profiles,(SELECT COUNT(*) FROM economic_graph_relationships) AS relationships,(SELECT COUNT(*) FROM economic_evidence_vault) AS evidence`);return r.rows[0]}));
 checks.push(await check('assessment_integrity',async()=>{const r=await db.query(`SELECT COUNT(*)::int AS total FROM graph_assessments`);return {assessments:r.rows[0].total}}));
 checks.push(await check('provenance_integrity',async()=>{const r=await db.query(`SELECT COUNT(*)::int AS total FROM economic_consensus_reconciliation_runs`);return {reconciliationRuns:r.rows[0].total}}));
 const failed=checks.filter(x=>x.status==='failed').length;
 return {status:failed?'failed':'ok',checks,passed:checks.length-failed,failed};
}

export default async function(req,res){
 const result=await runChecks();
 if(req.method==='GET')return res.json({platform:'ÒsánVault Africa',phase:'OV-19.10',...result,releaseGate:result.failed===0?'eligible_for_internal_validation':'blocked'});
 const run=await db.query(`INSERT INTO platform_stabilization_runs(run_type,status,checks,passed_count,failed_count,warning_count,completed_at) VALUES($1,$2,$3,$4,$5,$6,now()) RETURNING id,created_at AS "createdAt"`,['manual',result.status,JSON.stringify(result.checks),result.passed,result.failed,0]);
 res.status(result.failed?500:201).json({platform:'ÒsánVault Africa',phase:'OV-19.10',runId:run.rows[0].id,...result,releaseGate:result.failed===0?'eligible_for_internal_validation':'blocked'});
}