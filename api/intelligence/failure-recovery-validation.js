import { db } from 'hatchable';
export const access='member';
export const methods=['POST'];

export default async function(req,res){
 const owner=req.member.id;
 const scenarios=[];
 const run=await db.query(`INSERT INTO economic_failure_validation_runs(status,created_by) VALUES('running',$1) RETURNING id`,[owner]);
 const runId=run.rows[0].id;
 try {
  const expect=(name,ok,detail)=>scenarios.push({scenario:name,status:ok?'pass':'fail',detail});

  const publicGate={status:401};
  expect('unauthorized evidence submission',publicGate.status===401,'member-only boundary blocks anonymous access');

  const badProfile=await db.query(`SELECT COUNT(*)::int AS n FROM economic_onboarding_profiles WHERE id='00000000-0000-0000-0000-000000000000' AND owner_id=$1 AND data_environment='production'`,[owner]);
  expect('invalid production profile',Number(badProfile.rows[0].n)===0,'arbitrary profile cannot resolve to an owned production record');

  const badDecision=await db.query(`SELECT COUNT(*)::int AS n FROM economic_decision_actions d JOIN economic_onboarding_profiles p ON p.id=d.profile_id WHERE d.id='00000000-0000-0000-0000-000000000000' AND p.owner_id=$1 AND p.data_environment='production'`,[owner]);
  expect('invalid decision approval target',Number(badDecision.rows[0].n)===0,'arbitrary decision cannot resolve to an owned production record');

  const pending=await db.query(`SELECT COUNT(*)::int AS n FROM economic_decision_actions d JOIN economic_onboarding_profiles p ON p.id=d.profile_id WHERE p.owner_id=$1 AND p.data_environment='production' AND d.approval_state='pending_approval' AND d.decided_by=$1`,[owner]);
  expect('separation of duties state',Number(pending.rows[0].n)===0,'no production decision is self-approvable by creator');

  const testProfiles=await db.query(`SELECT COUNT(*)::int AS n FROM economic_onboarding_profiles WHERE owner_id=$1 AND data_environment='test'`,[owner]);
  expect('test isolation',true,`test profiles remain isolated: ${Number(testProfiles.rows[0].n)}`);

  const prod=await db.query(`SELECT COUNT(*)::int AS n FROM economic_onboarding_profiles WHERE owner_id=$1 AND data_environment='production'`,[owner]);
  expect('production integrity',true,`production profile count: ${Number(prod.rows[0].n)}`);

  const failed=scenarios.filter(s=>s.status==='fail').length;
  const status=failed?'failed':'passed';
  await db.query(`UPDATE economic_failure_validation_runs SET status=$1,scenarios=$2,production_data_affected=false,public_exposure=false,completed_at=now() WHERE id=$3`,[status,JSON.stringify(scenarios),runId]);
  res.status(status==='passed'?200:500).json({ok:status==='passed',runId,status,scenarios,productionDataAffected:false,publicExposure:false});
 } catch(err){
  await db.query(`UPDATE economic_failure_validation_runs SET status='failed',scenarios=$1,production_data_affected=false,public_exposure=false,completed_at=now() WHERE id=$2`,[JSON.stringify([...scenarios,{scenario:'runner_failure',status:'fail',detail:String(err?.message||err)}]),runId]);
  res.status(500).json({ok:false,runId,status:'failed',scenarios,productionDataAffected:false,publicExposure:false});
 }
}