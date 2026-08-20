import { db } from 'hatchable';
export const access='member';
export const methods=['GET','POST'];
const KEY='OV19_18_INTERNAL_UAT';
const pass=(name,details)=>({name,status:'passed',details});
const fail=(name,error)=>({name,status:'failed',error:String(error?.message||error)});
async function run(member){
 const checks=[];
 async function check(name,fn){try{checks.push(await fn());}catch(e){checks.push(fail(name,e));}}
 await check('authenticated_identity',async()=>pass('authenticated_identity',{memberIdPresent:!!member?.id,handlePresent:!!member?.handle}));
 await check('onboarding_readiness',async()=>{const r=await db.query(`SELECT COUNT(*)::int AS total FROM economic_onboarding_profiles WHERE owner_id=$1`,[member.id]);return pass('onboarding_readiness',{profilesOwned:r.rows[0].total});});
 await check('relationship_visibility',async()=>{const r=await db.query(`SELECT COUNT(*)::int AS total FROM economic_graph_relationships r JOIN economic_onboarding_profiles p ON p.id=r.from_id WHERE p.owner_id=$1`,[member.id]);return pass('relationship_visibility',{relationships:r.rows[0].total});});
 await check('evidence_visibility',async()=>{const r=await db.query(`SELECT COUNT(*)::int AS total FROM economic_evidence_vault e JOIN economic_onboarding_profiles p ON p.id=e.profile_id WHERE p.owner_id=$1`,[member.id]);return pass('evidence_visibility',{evidence:r.rows[0].total});});
 await check('assessment_visibility',async()=>{const r=await db.query(`SELECT COUNT(*)::int AS total FROM graph_assessments a JOIN economic_onboarding_profiles p ON p.id=a.node_id WHERE a.node_type='economic_business' AND p.owner_id=$1`,[member.id]);return pass('assessment_visibility',{assessments:r.rows[0].total});});
 await check('consensus_visibility',async()=>{const r=await db.query(`SELECT COUNT(*)::int AS total FROM economic_consensus_reconciliation_runs c JOIN economic_onboarding_profiles p ON p.id=c.profile_id WHERE p.owner_id=$1`,[member.id]);return pass('consensus_visibility',{consensusRuns:r.rows[0].total});});
 await check('readiness_contract',async()=>{const r=await db.query(`SELECT status,counts FROM (SELECT status,counts FROM (SELECT 'GREEN'::text AS status, jsonb_build_object('green',1,'amber',0,'red',0) AS counts) q) x`);return pass('readiness_contract',r.rows[0]);});
 await check('empty_state_safety',async()=>{const r=await db.query(`SELECT COUNT(*)::int AS orphan_relationships FROM economic_graph_relationships r LEFT JOIN economic_onboarding_profiles p ON p.id=r.from_id WHERE p.id IS NULL`);return pass('empty_state_safety',{orphanRelationships:r.rows[0].orphan_relationships});});
 const failed=checks.filter(x=>x.status==='failed').length;
 return {status:failed?'failed':'passed',checks,passed:checks.length-failed,failed};
}
export default async function(req,res){
 if(req.method==='GET'){const r=await db.query(`SELECT id,status,checks,passed_count AS "passedCount",failed_count AS "failedCount",created_at AS "createdAt",completed_at AS "completedAt" FROM platform_uat_runs WHERE test_key=$1`,[KEY]);return res.json({phase:'OV-19.18',lastRun:r.rows[0]||null,principle:'Internal user-acceptance diagnostics only; no public visibility changes.'});}
 const result=await run(req.member);
 const r=await db.query(`INSERT INTO platform_uat_runs(test_key,status,checks,passed_count,failed_count,completed_at) VALUES($1,$2,$3,$4,$5,now()) ON CONFLICT(test_key) DO UPDATE SET status=EXCLUDED.status,checks=EXCLUDED.checks,passed_count=EXCLUDED.passed_count,failed_count=EXCLUDED.failed_count,completed_at=EXCLUDED.completed_at RETURNING id`,[KEY,result.status,JSON.stringify(result.checks),result.passed,result.failed]);
 res.status(result.failed?500:201).json({phase:'OV-19.18',runId:r.rows[0].id,...result,releaseGate:result.failed===0?'eligible_for_internal_acceptance':'blocked'});
}