import { db } from 'hatchable';
export const access='member';
export const methods=['GET'];
export default async function(req,res){
 const owner=req.member.id, checks=[]; const key=`OV216-${Date.now()}`;
 const run=await db.query(`INSERT INTO economic_security_integrity_runs(run_key,status,created_by) VALUES($1,'running',$2) RETURNING id`,[key,owner]);
 const runId=run.rows[0].id;
 const p=await db.query(`SELECT COUNT(*)::int AS total,COUNT(*) FILTER(WHERE data_environment='production')::int AS production,COUNT(*) FILTER(WHERE data_environment='test')::int AS test FROM economic_onboarding_profiles WHERE owner_id=$1`,[owner]);
 checks.push({key:'production_boundary',status:Number(p.rows[0].production)===0?'pass':'review',details:{production:Number(p.rows[0].production),test:Number(p.rows[0].test)}});
 const tables=[['network','economic_network_intelligence'],['consensus','economic_decision_consensus'],['execution','economic_decision_execution'],['feedback','economic_intelligence_feedback']];
 for(const [key,table] of tables){const q=await db.query(`SELECT COUNT(*)::int AS orphaned FROM ${table} x LEFT JOIN economic_onboarding_profiles p ON p.id=x.profile_id WHERE p.id IS NULL`,[]);checks.push({key:`${key}_orphan_check`,status:Number(q.rows[0].orphaned)===0?'pass':'fail',details:{orphaned:Number(q.rows[0].orphaned)}});}
 const selfApproval=await db.query(`SELECT COUNT(*)::int AS invalid FROM economic_decision_actions WHERE approval_by IS NOT NULL AND decided_by IS NOT NULL AND approval_by=decided_by`,[]);
 checks.push({key:'separation_of_duties',status:Number(selfApproval.rows[0].invalid)===0?'pass':'fail',details:{invalid:Number(selfApproval.rows[0].invalid)}});
 const duplicateExec=await db.query(`SELECT COUNT(*)::int AS duplicate_groups FROM (SELECT decision_action_id FROM economic_decision_execution GROUP BY decision_action_id HAVING COUNT(*)>1) d`,[]);
 checks.push({key:'execution_replay_protection',status:Number(duplicateExec.rows[0].duplicate_groups)===0?'pass':'fail',details:{duplicateGroups:Number(duplicateExec.rows[0].duplicate_groups)}});
 const invalidTransitions=await db.query(`SELECT COUNT(*)::int AS invalid FROM economic_decision_execution WHERE execution_status NOT IN ('not_started','in_progress','completed','cancelled')`,[]);
 checks.push({key:'execution_state_integrity',status:Number(invalidTransitions.rows[0].invalid)===0?'pass':'fail',details:{invalid:Number(invalidTransitions.rows[0].invalid)}});
 const sensitive=await db.query(`SELECT COUNT(*)::int AS exposed FROM economic_decision_governance_events WHERE notes ILIKE '%password%' OR notes ILIKE '%secret%' OR notes ILIKE '%private key%'`,[]);
 checks.push({key:'sensitive_audit_content',status:Number(sensitive.rows[0].exposed)===0?'pass':'review',details:{flagged:Number(sensitive.rows[0].exposed)}});
 const failed=checks.filter(c=>c.status==='fail').length; const review=checks.filter(c=>c.status==='review').length; const status=failed?'failed':review?'review':'passed';
 await db.query(`UPDATE economic_security_integrity_runs SET status=$1,checks=$2,completed_at=now() WHERE id=$3`,[status,JSON.stringify(checks),runId]);
 res.json({ok:true,runId,status,checks,productionDataAffected:false,publicExposure:false,next:status==='passed'?'private_production_gate':'remediation'});
}