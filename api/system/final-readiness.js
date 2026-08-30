import { db } from 'hatchable';
export const access='admin';
export const methods=['GET','POST'];
const KEY='OV19_21_FINAL_GATE_RECONCILIATION';
const green=(name,details)=>({name,status:'GREEN',details});
const amber=(name,details)=>({name,status:'AMBER',details});
const red=(name,details)=>({name,status:'RED',details});

async function probe(name,sql,params=[]){try{const r=await db.query(sql,params);return green(name,{reachable:true,rows:r.rows.length});}catch(e){return red(name,{reachable:false,error:String(e?.message||e)});}}
async function run(){
 const checks=[];
 checks.push(await probe('database','SELECT 1 AS ok'));
 checks.push(await probe('onboarding_runtime','SELECT COUNT(*)::int AS total FROM economic_onboarding_profiles'));
 checks.push(await probe('relationships_runtime','SELECT COUNT(*)::int AS total FROM economic_graph_relationships'));
 checks.push(await probe('evidence_runtime','SELECT COUNT(*)::int AS total FROM economic_evidence_vault'));
 checks.push(await probe('assessments_runtime','SELECT COUNT(*)::int AS total FROM graph_assessments'));
 checks.push(await probe('network_feedback_runtime','SELECT COUNT(*)::int AS total FROM economic_network_feedback_runs'));
 checks.push(await probe('consensus_runtime','SELECT COUNT(*)::int AS total FROM economic_consensus_reconciliation_runs'));
 checks.push(await probe('conflicts_runtime','SELECT COUNT(*)::int AS total FROM economic_consensus_conflicts'));
 checks.push(await probe('stabilization_runtime','SELECT COUNT(*)::int AS total FROM platform_stabilization_runs'));
 checks.push(await probe('e2e_runtime','SELECT COUNT(*)::int AS total FROM platform_e2e_test_runs'));
 checks.push(await probe('failure_recovery_runtime','SELECT COUNT(*)::int AS total FROM platform_failure_recovery_runs'));
 checks.push(await probe('simulation_runtime','SELECT COUNT(*)::int AS total FROM platform_business_simulation_runs'));
 checks.push(await probe('uat_runtime','SELECT COUNT(*)::int AS total FROM platform_uat_runs'));
 try{const r=await db.query(`SELECT status,failed_count AS failed FROM platform_failure_recovery_runs WHERE test_key='OV19_12_FAILURE_RECOVERY' ORDER BY created_at DESC LIMIT 1`);const x=r.rows[0];checks.push(x&&x.status==='passed'&&Number(x.failed)===0?green('failure_recovery',x):amber('failure_recovery',x||{message:'no recorded run'}));}catch(e){checks.push(red('failure_recovery',{error:String(e?.message||e)}));}
 try{const r=await db.query(`SELECT status,failed_count AS failed FROM platform_uat_runs WHERE test_key='OV19_18_INTERNAL_UAT' ORDER BY created_at DESC LIMIT 1`);const x=r.rows[0];checks.push(x&&x.status==='passed'&&Number(x.failed)===0?green('uat',x):amber('uat',x||{message:'no recorded run'}));}catch(e){checks.push(red('uat',{error:String(e?.message||e)}));}
 try{const r=await db.query(`SELECT status,cleanup_status AS cleanup FROM platform_business_simulation_runs WHERE simulation_key='OV19_17_REALISTIC_BUSINESS_SIMULATION' ORDER BY created_at DESC LIMIT 1`);const x=r.rows[0];checks.push(x&&x.status==='passed'&&x.cleanup==='cleaned'?green('business_simulation',x):amber('business_simulation',x||{message:'no recorded run'}));}catch(e){checks.push(red('business_simulation',{error:String(e?.message||e)}));}
 try{const r=await db.query(`SELECT COUNT(*)::int AS orphan_relationships FROM economic_graph_relationships r LEFT JOIN economic_onboarding_profiles p ON p.id=r.from_id WHERE p.id IS NULL`);checks.push(Number(r.rows[0].orphan_relationships)===0?green('data_hygiene',r.rows[0]):red('data_hygiene',r.rows[0]));}catch(e){checks.push(red('data_hygiene',{error:String(e?.message||e)}));}
 const greenCount=checks.filter(x=>x.status==='GREEN').length,amberCount=checks.filter(x=>x.status==='AMBER').length,redCount=checks.filter(x=>x.status==='RED').length;
 const decision=redCount===0&&amberCount===0?'GO':'NO_GO';
 return {phase:'OV-19.21',decision,counts:{green:greenCount,amber:amberCount,red:redCount},checks,visibility:'private'};
}
export default async function(req,res){
 const result=await run();
 const r=await db.query(`INSERT INTO platform_final_readiness_runs(gate_key,decision,checks,green_count,amber_count,red_count,completed_at) VALUES($1,$2,$3,$4,$5,$6,now()) ON CONFLICT(gate_key) DO UPDATE SET decision=EXCLUDED.decision,checks=EXCLUDED.checks,green_count=EXCLUDED.green_count,amber_count=EXCLUDED.amber_count,red_count=EXCLUDED.red_count,completed_at=EXCLUDED.completed_at RETURNING id`,[KEY,result.decision,JSON.stringify(result.checks),result.counts.green,result.counts.amber,result.counts.red]);
 res.status(result.decision==='GO'?200:409).json({platform:'ÒsánVault Africa',runId:r.rows[0].id,...result,releaseGate:result.decision==='GO'?'GO':'NO_GO',principle:'Internal gate only; no public exposure.'});
}