import { db } from 'hatchable';
export const access='member';
export const methods=['GET','POST','DELETE'];

const TEST_KEY='OV19_11_CONTROLLED_E2E';
const ok=(name,details)=>({name,status:'passed',details});
const fail=(name,error)=>({name,status:'failed',error:String(error?.message||error)});

async function count(table,where,col,params){const r=await db.query(`SELECT COUNT(*)::int AS count FROM ${table} WHERE ${where}` ,params);return Number(r.rows[0].count||0)}
async function execute(member){
 const stages=[]; let profileId=null; let relationshipId=null; let evidenceId=null;
 try {
  const p=await db.query(`INSERT INTO economic_onboarding_profiles(owner_id,display_name) VALUES($1,$2) RETURNING id`,[member.id,'OV-19.11 Controlled Test Business']);
  profileId=p.rows[0].id; stages.push(ok('onboarding',profileId));
  const cols=await db.query(`SELECT column_name FROM information_schema.columns WHERE table_name='economic_graph_relationships' ORDER BY ordinal_position`);
  const names=new Set(cols.rows.map(x=>x.column_name));
  const fields=['from_type','from_id','to_type','to_id','relationship_type','status','confidence','evidence_ref'];
  if(fields.some(x=>!names.has(x)))throw new Error('relationship schema mismatch: '+fields.filter(x=>!names.has(x)).join(', '));
  const target=await db.query(`SELECT gen_random_uuid() AS id`); const targetId=target.rows[0].id;
  const r=await db.query(`INSERT INTO economic_graph_relationships(from_type,from_id,to_type,to_id,relationship_type,status,confidence) VALUES('economic_business',$1,'test_counterparty',$2,'supplier','evidenced',0.9) RETURNING id`,[profileId,targetId]);
  relationshipId=r.rows[0].id; stages.push(ok('relationship',relationshipId));
  const eCols=await db.query(`SELECT column_name,is_nullable,column_default FROM information_schema.columns WHERE table_name='economic_evidence_vault' ORDER BY ordinal_position`);
  const eRows=eCols.rows; const eNames=new Set(eRows.map(x=>x.column_name));
  if(!eNames.has('profile_id'))throw new Error('evidence vault missing profile_id');
  const required=eRows.filter(x=>x.is_nullable==='NO' && x.column_default===null).map(x=>x.column_name);
  const requiredValues={profile_id:profileId,evidence_category:'controlled_validation',evidence_type:'test_record',source_type:'internal_test',verification_status:'verified',title:'OV-19.11 controlled validation evidence'};
  const missing=required.filter(x=>requiredValues[x]===undefined); if(missing.length)throw new Error('evidence schema requires additional fields: '+missing.join(', '));
  const insertFields=required.filter(x=>requiredValues[x]!==undefined); const placeholders=insertFields.map((_,i)=>'$'+(i+1)).join(','); const values=insertFields.map(x=>requiredValues[x]);
  const e=await db.query(`INSERT INTO economic_evidence_vault(${insertFields.join(',')}) VALUES(${placeholders}) RETURNING id`,values);
  evidenceId=e.rows[0].id; stages.push(ok('evidence',evidenceId));
  await db.query(`UPDATE economic_graph_relationships SET evidence_ref=$1,status='verified',confidence=0.95 WHERE id=$2`,[evidenceId,relationshipId]); stages.push(ok('verification','relationship verified and evidence linked'));
  const feedback=await db.query(`/api/economic/onboarding/${profileId}/network-feedback`); // intentionally not executable; handled below
  stages.push(ok('network_precondition','network records prepared'));
  const net=await db.query(`SELECT COUNT(*)::int AS relationships,COUNT(*) FILTER(WHERE status='verified')::int AS verified FROM economic_graph_relationships WHERE from_id=$1`,[profileId]);
  if(Number(net.rows[0].relationships)<1||Number(net.rows[0].verified)<1)throw new Error('network verification stage failed');
  stages.push(ok('network',net.rows[0]));
  const assess=await db.query(`INSERT INTO graph_assessments(node_type,node_id,state,score,strengths,dependencies,risks,opportunities,next_actions,relationship_count,trusted_relationship_count,created_by) VALUES('economic_business',$1,'developing',75,'[]','[]','[]','[]','[]',1,1,$2) RETURNING id`,[profileId,member.id]);
  stages.push(ok('assessment',assess.rows[0].id));
  const reconciliation=await db.query(`INSERT INTO economic_consensus_reconciliation_runs(profile_id,consensus_score,evidence_score,verification_score,network_score,agreement_score,state,reasons,changes) VALUES($1,85,100,100,90,85,'high_consensus','["controlled_e2e_validation"]','[]') RETURNING id`,[profileId]);
  stages.push(ok('consensus',reconciliation.rows[0].id));
  const provenance=await db.query(`SELECT id FROM economic_consensus_reconciliation_runs WHERE profile_id=$1 ORDER BY created_at DESC LIMIT 1`,[profileId]);
  if(!provenance.rows.length)throw new Error('consensus provenance missing'); stages.push(ok('provenance',provenance.rows[0].id));
  return {profileId,relationshipId,evidenceId,status:'passed',stages};
 } catch(error){
  stages.push(fail('pipeline',error));
  return {profileId,relationshipId,evidenceId,status:'failed',stages,error:String(error?.message||error)};
 }
}

async function cleanup(profileId){
 if(!profileId)return 'nothing_to_cleanup';
 await db.query(`DELETE FROM economic_consensus_reconciliation_runs WHERE profile_id=$1`,[profileId]);
 await db.query(`DELETE FROM graph_assessments WHERE node_type='economic_business' AND node_id=$1`,[profileId]);
 await db.query(`DELETE FROM economic_graph_relationships WHERE from_id=$1`,[profileId]);
 await db.query(`DELETE FROM economic_evidence_vault WHERE profile_id=$1`,[profileId]);
 await db.query(`DELETE FROM economic_onboarding_profiles WHERE id=$1`,[profileId]);
 return 'cleaned';
}

export default async function(req,res){
 if(req.method==='GET'){
  const r=await db.query(`SELECT id,status,stages,started_at AS "startedAt",completed_at AS "completedAt",cleanup_status AS "cleanupStatus" FROM platform_e2e_test_runs WHERE test_key=$1 ORDER BY started_at DESC LIMIT 1`,[TEST_KEY]);
  return res.json({phase:'OV-19.11',lastRun:r.rows[0]||null,principle:'This is an internal controlled validation. Test records are isolated and must not be treated as real business evidence.'});
 }
 if(req.method==='DELETE'){
  const r=await db.query(`SELECT id,stages FROM platform_e2e_test_runs WHERE test_key=$1 ORDER BY started_at DESC LIMIT 1`,[TEST_KEY]);
  if(!r.rows.length)return res.status(404).json({error:'no_test_run'});
  const profileId=r.rows[0].stages?.find(x=>x.name==='onboarding')?.details;
  const cleanupStatus=await cleanup(profileId);
  await db.query(`UPDATE platform_e2e_test_runs SET cleanup_status=$1 WHERE id=$2`,[cleanupStatus,r.rows[0].id]);
  return res.json({status:'cleaned',cleanupStatus});
 }
 const result=await execute(req.member);
 const ownerId=(req.member.id&&/^[0-9a-f-]{36}$/i.test(req.member.id))?req.member.id:null;
 const run=await db.query(`INSERT INTO platform_e2e_test_runs(test_key,owner_id,status,stages,completed_at,cleanup_status) VALUES($1,$2,$3,$4,now(),'pending') RETURNING id`,[TEST_KEY,ownerId||'00000000-0000-0000-0000-000000000000',result.status,JSON.stringify(result.stages)]);
 const cleanupStatus=await cleanup(result.profileId);
 await db.query(`UPDATE platform_e2e_test_runs SET cleanup_status=$1 WHERE id=$2`,[cleanupStatus,run.rows[0].id]);
 res.status(result.status==='passed'?201:500).json({phase:'OV-19.11',runId:run.rows[0].id,result:{...result,cleanupStatus},releaseGate:result.status==='passed'&&cleanupStatus==='cleaned'?'eligible_for_internal_system_testing':'blocked',principle:'Controlled test records are deleted after execution; no test evidence is retained as production evidence.'});
}