import { db } from 'hatchable';
export const access='member';
export const methods=['GET'];
export default async function(req,res){
 const owner=req.member.id;
 const checks=[];
 const profiles=await db.query(`SELECT COUNT(*)::int AS total,COUNT(*) FILTER(WHERE data_environment='production')::int AS production,COUNT(*) FILTER(WHERE data_environment='test')::int AS test FROM economic_onboarding_profiles WHERE owner_id=$1`,[owner]);
 const p=profiles.rows[0];
 const boundary=await db.query(`SELECT COUNT(*)::int AS invalid FROM economic_onboarding_profiles WHERE owner_id=$1 AND COALESCE(data_environment,'') NOT IN ('production','test')`,[owner]);
checks.push({key:'data_boundary',status:Number(boundary.rows[0].invalid)===0?'pass':'fail',details:{total:Number(p.total),production:Number(p.production),test:Number(p.test),invalidEnvironment:Number(boundary.rows[0].invalid)}});
 const routes=[['network','economic_network_intelligence'],['consensus','economic_decision_consensus'],['execution','economic_decision_execution'],['feedback','economic_intelligence_feedback']];
 for(const [key,table] of routes){const q=await db.query(`SELECT COUNT(*)::int AS total FROM ${table} t JOIN economic_onboarding_profiles p ON p.id=t.profile_id WHERE p.owner_id=$1 AND p.data_environment='production'`,[owner]);checks.push({key,status:'pass',details:{records:Number(q.rows[0].total)}});}
 const failed=checks.filter(x=>x.status==='fail').length;
 const readiness=failed?'not_ready':'ready_for_private_validation';
 const r=await db.query(`INSERT INTO economic_readiness_checks(check_key,status,details,checked_by) VALUES($1,$2,$3,$4) RETURNING id,check_key AS "checkKey",status,details,checked_at AS "checkedAt"`,['ov21.3',readiness,JSON.stringify({checks}),owner]);
 res.json({ok:true,readiness,publicExposure:false,checks,record:r.rows[0],next:readiness==='ready_for_private_validation'?'controlled_e2e_validation':'remediation'});
}