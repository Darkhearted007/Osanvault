import { db } from 'hatchable';
export const access='member';
export const methods=['GET','POST'];

const expected=[
 ['economic_onboarding_profiles',['id','owner_id','display_name']],
 ['economic_activity_records',['id','profile_id']],
 ['economic_graph_relationships',['id','from_type','from_id','to_type','to_id','relationship_type','status','confidence','evidence_ref']],
 ['economic_evidence_vault',['id','profile_id','evidence_category','title','source_type','verification_status','submitted_by']],
 ['graph_assessments',['id','node_type','node_id','state','score','relationship_count','trusted_relationship_count']],
 ['economic_network_feedback_runs',['id','profile_id','connectivity_score','trusted_network_score','state']],
 ['economic_consensus_reconciliation_runs',['id','profile_id','consensus_score','evidence_score','verification_score','network_score','agreement_score','state']],
 ['economic_consensus_conflicts',['id','reconciliation_id','profile_id','conflict_type','subject','resolution_state']],
 ['platform_stabilization_runs',['id','status','checks','passed_count','failed_count']],
 ['platform_e2e_test_runs',['id','test_key','status','stages','cleanup_status']],
 ['platform_failure_recovery_runs',['id','test_key','status','cases','passed_count','failed_count']]
];

async function inspect(){
 const results=[];
 for(const [table,columns] of expected){
  const t=await db.query(`SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=$1) AS exists`,[table]);
  if(!t.rows[0].exists){results.push({table,status:'missing',missingColumns:columns});continue;}
  const c=await db.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1`,[table]);
  const have=new Set(c.rows.map(x=>x.column_name));
  const missing=columns.filter(x=>!have.has(x));
  const count=await db.query(`SELECT COUNT(*)::int AS count FROM ${table}`);
  results.push({table,status:missing.length?'schema_drift':'ok',missingColumns:missing,rowCount:count.rows[0].count});
 }
 return results;
}

export default async function(req,res){
 const results=await inspect();
 const missing=results.filter(x=>x.status==='missing');
 const drift=results.filter(x=>x.status==='schema_drift');
 const status=missing.length||drift.length?'reconciliation_required':'reconciled';
 const payload={phase:'OV-19.13',status,summary:{expected:results.length,ok:results.filter(x=>x.status==='ok').length,missing:missing.length,schemaDrift:drift.length},tables:results,principle:'This check observes the deployed API runtime schema. It does not create, drop, or mutate production tables automatically.'};
 if(req.method==='GET')return res.json(payload);
 await db.query(`INSERT INTO platform_stabilization_runs(run_type,status,checks,passed_count,failed_count,warning_count,completed_at) VALUES($1,$2,$3,$4,$5,$6,now())`,['migration_reconciliation',status,JSON.stringify(results),results.filter(x=>x.status==='ok').length,missing.length,drift.length]);
 res.status(status==='reconciled'?201:409).json({...payload,recorded:true});
}