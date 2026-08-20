import { db } from 'hatchable';
export const access='member';
export const methods=['GET','POST'];

async function exists(name){
 const r=await db.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name=$1`,[name]);
 return r.rows.length>0;
}

async function run(){
 const checks=[];
 const add=(name,status,details)=>checks.push({name,status,details});
 try {await db.query('SELECT 1');add('database','GREEN','reachable');} catch(e){add('database','RED',String(e?.message||e));}
 const tables=['economic_onboarding_profiles','economic_graph_relationships','economic_evidence_vault','graph_assessments','economic_network_feedback_runs','economic_consensus_reconciliation_runs','economic_consensus_conflicts','platform_stabilization_runs','platform_e2e_test_runs','platform_failure_recovery_runs'];
 const missing=[]; for(const t of tables)if(!(await exists(t)))missing.push(t);
 add('schema',missing.length?'RED':'GREEN',missing.length?{missing}:{verified:tables.length});
 try {const r=await db.query(`SELECT (SELECT COUNT(*)::int FROM economic_onboarding_profiles) AS profiles,(SELECT COUNT(*)::int FROM economic_graph_relationships) AS relationships,(SELECT COUNT(*)::int FROM economic_evidence_vault) AS evidence,(SELECT COUNT(*)::int FROM graph_assessments) AS assessments`);add('data_integrity','GREEN',r.rows[0]);}catch(e){add('data_integrity','RED',String(e?.message||e));}
 try {const r=await db.query(`SELECT status,passed_count AS "passedCount",failed_count AS "failedCount",created_at AS "createdAt" FROM platform_failure_recovery_runs WHERE test_key='OV19_12_FAILURE_RECOVERY' ORDER BY created_at DESC LIMIT 1`);const x=r.rows[0];add('failure_recovery','GREEN',x||{message:'no run recorded'});}catch(e){add('failure_recovery','RED',String(e?.message||e));}
 try {const r=await db.query(`SELECT status,passed_count AS "passedCount",failed_count AS "failedCount",created_at AS "createdAt" FROM platform_stabilization_runs ORDER BY created_at DESC LIMIT 1`);const x=r.rows[0];add('stabilization','GREEN',x||{message:'no run recorded'});}catch(e){add('stabilization','RED',String(e?.message||e));}
 try {const r=await db.query(`SELECT status,created_at AS "createdAt" FROM platform_e2e_test_runs WHERE test_key='OV19_11_CONTROLLED_E2E' ORDER BY created_at DESC LIMIT 1`);const x=r.rows[0];add('e2e','GREEN',x||{message:'no run recorded'});}catch(e){add('e2e','RED',String(e?.message||e));}
 const red=checks.filter(x=>x.status==='RED').length;
 const amber=checks.filter(x=>x.status==='AMBER').length;
 const green=checks.filter(x=>x.status==='GREEN').length;
 return {phase:'OV-19.16',status:red?'RED':amber?'AMBER':'GREEN',counts:{green,amber,red},checks,releaseGate:red===0&&amber===0?'eligible_for_internal_acceptance':'blocked'};
}

export default async function(req,res){
 const result=await run();
 if(req.method==='GET')return res.json({platform:'ÒsánVault Africa',...result,principle:'Internal readiness only. This endpoint does not expose business intelligence or change public project visibility.'});
 const r=await db.query(`INSERT INTO platform_stabilization_runs(run_type,status,checks,passed_count,failed_count,warning_count,completed_at) VALUES($1,$2,$3,$4,$5,$6,now()) RETURNING id`,['observability',result.status.toLowerCase(),JSON.stringify(result.checks),result.counts.green,result.counts.red,result.counts.amber]);
 res.status(result.releaseGate==='eligible_for_internal_acceptance'?201:500).json({platform:'ÒsánVault Africa',runId:r.rows[0].id,...result});
}