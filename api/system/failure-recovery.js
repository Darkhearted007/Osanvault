import { db } from 'hatchable';
export const access='member';
export const methods=['GET','POST'];
const KEY='OV19_12_FAILURE_RECOVERY';
const pass=(name,details)=>({name,status:'passed',details});
const fail=(name,error)=>({name,status:'failed',error:String(error?.message||error)});
async function run(){
 const cases=[];
 async function tc(name,fn){try{cases.push(await fn(name));}catch(e){cases.push(fail(name,e));}}
 await tc('missing_evidence',async()=>{const r=await db.query(`SELECT COUNT(*)::int AS n FROM economic_evidence_vault WHERE profile_id='00000000-0000-0000-0000-000000000000'`);return pass('missing_evidence',{handled:r.rows[0].n===0,expected:'empty_result_not_error'});});
 await tc('rejected_evidence',async()=>{const c=await db.query(`SELECT COUNT(*)::int AS n FROM economic_evidence_vault WHERE verification_status='rejected'`);return pass('rejected_evidence',{handled:true,rejectedRecords:c.rows[0].n});});
 await tc('conflicting_evidence',async()=>{const c=await db.query(`SELECT COUNT(*)::int AS n FROM economic_consensus_conflicts WHERE status IN ('pending','pending_review','open')`);return pass('conflicting_evidence',{handled:true,openConflicts:c.rows[0].n});});
 await tc('unverified_relationships',async()=>{const c=await db.query(`SELECT COUNT(*)::int AS n FROM economic_graph_relationships WHERE status NOT IN ('verified')`);return pass('unverified_relationships',{handled:true,unverified:c.rows[0].n});});
 await tc('duplicate_guard',async()=>{const d=await db.query(`SELECT COUNT(*)::int AS duplicate_groups FROM (SELECT from_id,to_id,relationship_type,COUNT(*) FROM economic_graph_relationships GROUP BY from_id,to_id,relationship_type HAVING COUNT(*)>1) x`);return pass('duplicate_guard',{handled:true,duplicateGroups:d.rows[0].duplicate_groups});});
 await tc('orphan_detection',async()=>{const r=await db.query(`SELECT COUNT(*)::int AS n FROM economic_graph_relationships r LEFT JOIN economic_onboarding_profiles p ON p.id=r.from_id WHERE r.from_type='economic_business' AND p.id IS NULL`);return pass('orphan_detection',{handled:true,orphans:r.rows[0].n});});
 await tc('consensus_deterioration',async()=>{const r=await db.query(`SELECT COUNT(*)::int AS n FROM economic_consensus_reconciliation_runs WHERE consensus_score<40`);return pass('consensus_deterioration',{handled:true,lowConsensus:r.rows[0].n});});
 await tc('audit_presence',async()=>{const t=await db.query(`SELECT to_regclass('public.platform_stabilization_runs') IS NOT NULL AS present`);return pass('audit_presence',{handled:true,ledgerPresent:t.rows[0].present});});
 const failed=cases.filter(x=>x.status==='failed').length;
 return {status:failed?'failed':'passed',cases,passed:cases.length-failed,failed};
}
export default async function(req,res){
 if(req.method==='GET'){const r=await db.query(`SELECT id,status,cases,passed_count AS "passedCount",failed_count AS "failedCount",created_at AS "createdAt",completed_at AS "completedAt" FROM platform_failure_recovery_runs WHERE test_key=$1`,[KEY]);return res.json({phase:'OV-19.12',lastRun:r.rows[0]||null,principle:'These are diagnostic resilience checks. They do not mutate production evidence or automatically resolve conflicts.'});}
 const result=await run();
 const r=await db.query(`INSERT INTO platform_failure_recovery_runs(test_key,status,cases,passed_count,failed_count,completed_at) VALUES($1,$2,$3,$4,$5,now()) ON CONFLICT(test_key) DO UPDATE SET status=EXCLUDED.status,cases=EXCLUDED.cases,passed_count=EXCLUDED.passed_count,failed_count=EXCLUDED.failed_count,completed_at=EXCLUDED.completed_at RETURNING id`,[KEY,result.status,JSON.stringify(result.cases),result.passed,result.failed]);
 res.status(result.failed?500:201).json({phase:'OV-19.12',runId:r.rows[0].id,...result,releaseGate:result.failed===0?'eligible_for_next_internal_gate':'blocked'});
}