import { db } from 'hatchable';
export const access='member';
export const methods=['GET'];
export default async function(req,res){
 const actor=req.member.id;
 const checks=[];
 const p=await db.query(`SELECT COUNT(*)::int AS total,COUNT(*) FILTER(WHERE data_environment='production')::int AS production,COUNT(*) FILTER(WHERE data_environment='test')::int AS test FROM economic_onboarding_profiles WHERE owner_id=$1`,[actor]);
 const production=Number(p.rows[0].production||0),test=Number(p.rows[0].test||0);
 checks.push({key:'production_data_boundary',status:production===0?'pass':'fail',details:{production,test}});
 const orphanTables=[['network','economic_network_intelligence','profile_id'],['assessment','graph_assessments','node_id'],['consensus','economic_decision_consensus','profile_id'],['decision','economic_decision_actions','profile_id'],['execution','economic_decision_execution','profile_id'],['feedback','economic_intelligence_feedback','profile_id']];
 for(const [key,table,column] of orphanTables){const q=await db.query(`SELECT COUNT(*)::int AS orphaned FROM ${table} x LEFT JOIN economic_onboarding_profiles p ON p.id=x.${column} WHERE p.id IS NULL`,[]);checks.push({key:`${key}_ownership`,status:Number(q.rows[0].orphaned)===0?'pass':'fail',details:{orphaned:Number(q.rows[0].orphaned)}});}
 const invalid=await db.query(`SELECT COUNT(*)::int AS invalid FROM economic_decision_actions WHERE approval_state NOT IN ('pending_approval','approved','rejected','review_required')`,[]);
 checks.push({key:'decision_state_integrity',status:Number(invalid.rows[0].invalid)===0?'pass':'fail',details:{invalid:Number(invalid.rows[0].invalid)}});
 const duplicate=await db.query(`SELECT COUNT(*)::int AS duplicate_groups FROM (SELECT decision_action_id FROM economic_decision_execution GROUP BY decision_action_id HAVING COUNT(*)>1) d`,[]);
 checks.push({key:'execution_idempotency',status:Number(duplicate.rows[0].duplicate_groups)===0?'pass':'fail',details:{duplicateGroups:Number(duplicate.rows[0].duplicate_groups)}});
 const failures=checks.filter(x=>x.status==='fail').length;
 const status=failures===0?'approved_for_private_production':'blocked';
 const gate=await db.query(`INSERT INTO economic_private_production_gates(gate_key,status,checks,production_profiles,public_exposure,approved_by) VALUES($1,$2,$3,$4,false,$5) RETURNING id,gate_key AS "gateKey",status,production_profiles AS "productionProfiles",public_exposure AS "publicExposure",created_at AS "createdAt"`,['OV-21.7',status,JSON.stringify(checks),production,actor]);
 res.json({ok:true,status,checks,gate:gate.rows[0],publicExposure:false,realProductionDataRequired:false,next:status==='approved_for_private_production'?'create_first_real_profile':'remediate'});
}