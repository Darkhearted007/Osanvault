import { db } from 'hatchable';
export const access='member';
export const methods=['GET','POST'];
const KEY='OV19_20_FINAL_INTERNAL_READINESS';
const ok=(name,details)=>({name,status:'GREEN',details});
const warn=(name,details)=>({name,status:'AMBER',details});
const bad=(name,details)=>({name,status:'RED',details});
async function table(name){const r=await db.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name=$1`,[name]);return r.rows.length>0;}
async function run(){
 const checks=[];
 try{await db.query('SELECT 1');checks.push(ok('database','reachable'));}catch(e){checks.push(bad('database',String(e?.message||e)));}
 const required=['economic_onboarding_profiles','economic_graph_relationships','economic_evidence_vault','graph_assessments','economic_network_feedback_runs','economic_consensus_reconciliation_runs','economic_consensus_conflicts','platform_stabilization_runs','platform_e2e_test_runs','platform_failure_recovery_runs','platform_business_simulation_runs','platform_uat_runs','platform_final_readiness_runs'];
 const missing=[];for(const t of required)if(!(await table(t)))missing.push(t);checks.push(missing.length?bad('schema',{missing}):ok('schema',{verified:required.length}));
 try{const r=await db.query(`SELECT status,failed_count AS failed FROM platform_stabilization_runs WHERE run_type='observability' ORDER BY created_at DESC LIMIT 1`);const x=r.rows[0];checks.push(x&&x.status==='green'&&Number(x.failed)===0?ok('observability',x):warn('observability',x||{message:'no recorded observability run'}));}catch(e){checks.push(bad('observability',String(e?.message||e)));}
 try{const r=await db.query(`SELECT status,failed_count AS failed FROM platform_failure_recovery_runs WHERE test_key='OV19_12_FAILURE_RECOVERY' ORDER BY created_at DESC LIMIT 1`);const x=r.rows[0];checks.push(x&&x.status==='passed'&&Number(x.failed)===0?ok('failure_recovery',x):warn('failure_recovery',x||{message:'no recorded run'}));}catch(e){checks.push(bad('failure_recovery',String(e?.message||e)));}
 try{const r=await db.query(`SELECT status,failed_count AS failed FROM platform_uat_runs WHERE test_key='OV19_18_INTERNAL_UAT' ORDER BY created_at DESC LIMIT 1`);const x=r.rows[0];checks.push(x&&x.status==='passed'&&Number(x.failed)===0?ok('uat',x):warn('uat',x||{message:'no recorded run'}));}catch(e){checks.push(bad('uat',String(e?.message||e)));}
 try{const r=await db.query(`SELECT status,cleanup_status AS cleanup FROM platform_business_simulation_runs WHERE simulation_key='OV19_17_REALISTIC_BUSINESS_SIMULATION' ORDER BY created_at DESC LIMIT 1`);const x=r.rows[0];checks.push(x&&x.status==='passed'&&x.cleanup==='cleaned'?ok('business_simulation',x):warn('business_simulation',x||{message:'no recorded run'}));}catch(e){checks.push(bad('business_simulation',String(e?.message||e)));}
 try{const r=await db.query(`SELECT COUNT(*)::int AS orphan_relationships FROM economic_graph_relationships r LEFT JOIN economic_onboarding_profiles p ON p.id=r.from_id WHERE p.id IS NULL`);checks.push(Number(r.rows[0].orphan_relationships)===0?ok('data_hygiene',r.rows[0]):bad('data_hygiene',r.rows[0]));}catch(e){checks.push(bad('data_hygiene',String(e?.message||e)));}
 try{const r=await db.query(`SELECT COUNT(*)::int AS protected_runs FROM platform_e2e_test_runs`);checks.push(ok('audit_history',r.rows[0]));}catch(e){checks.push(bad('audit_history',String(e?.message||e)));}
 const green=checks.filter(x=>x.status==='GREEN').length,amber=checks.filter(x=>x.status==='AMBER').length,red=checks.filter(x=>x.status==='RED').length;
 const decision=red===0&&amber===0?'GO':'NO_GO';
 return {phase:'OV-19.20',decision,counts:{green,amber,red},checks,visibility:'private',principle:'Internal readiness gate only; this does not publish or expose ÒsánVault.'};
}
export default async function(req,res){const result=await run();if(req.method==='GET')return res.json({platform:'ÒsánVault Africa',...result});const r=await db.query(`INSERT INTO platform_final_readiness_runs(gate_key,decision,checks,green_count,amber_count,red_count,completed_at) VALUES($1,$2,$3,$4,$5,$6,now()) ON CONFLICT(gate_key) DO UPDATE SET decision=EXCLUDED.decision,checks=EXCLUDED.checks,green_count=EXCLUDED.green_count,amber_count=EXCLUDED.amber_count,red_count=EXCLUDED.red_count,completed_at=EXCLUDED.completed_at RETURNING id`,[KEY,result.decision,JSON.stringify(result.checks),result.counts.green,result.counts.amber,result.counts.red]);res.status(result.decision==='GO'?201:409).json({platform:'ÒsánVault Africa',runId:r.rows[0].id,...result});}