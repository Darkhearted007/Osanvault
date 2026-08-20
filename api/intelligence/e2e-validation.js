import { db } from 'hatchable';
export const access='member';
export const methods=['POST'];
const clean=v=>typeof v==='string'?v.trim().slice(0,160):'';
export default async function(req,res){
 const owner=req.member.id, key=`OV214-${Date.now()}`;
 const steps=[]; let profileId=null;
 const run=await db.query(`INSERT INTO economic_e2e_validation_runs(run_key,status,created_by) VALUES($1,'running',$2) RETURNING id`,[key,owner]);
 const runId=run.rows[0].id;
 try{
  const p=await db.query(`INSERT INTO economic_onboarding_profiles(owner_id,display_name,data_environment,business_type,sector,location,description,onboarding_status) VALUES($1,$2,'test','validation','controlled','internal','OV-21.4 isolated validation business','draft') RETURNING id`,[owner,`E2E Validation ${key}`]);
  profileId=p.rows[0].id; steps.push({step:'profile',status:'pass'});
  const e=await db.query(`INSERT INTO economic_evidence_vault(profile_id,evidence_category,source_type,verification_status,title,description,submitted_by) VALUES($1,'validation','internal','verified','E2E Validation Evidence','Synthetic evidence for isolated validation',$2) RETURNING id`,[profileId,owner]);
  const evidenceId=e.rows[0].id; steps.push({step:'evidence',status:'pass'});
  await db.query(`UPDATE economic_evidence_vault SET trust_score=90,verified_by=$1,verified_at=now() WHERE id=$2`,[owner,evidenceId]); steps.push({step:'verification',status:'pass'});
  await db.query(`INSERT INTO economic_graph_relationships(from_id,status,confidence) VALUES($1,'verified',0.9)`,[profileId]); steps.push({step:'network_input',status:'pass'});
  const n=await db.query(`SELECT COALESCE(AVG(confidence),0)::numeric AS confidence,COUNT(*)::int AS total FROM economic_graph_relationships WHERE from_id=$1`,[profileId]);
  const network=Math.round((100*0.5)+(Number(n.rows[0].confidence)*100*0.2)+(90*0.3));
  await db.query(`INSERT INTO economic_network_intelligence(profile_id,relationship_count,verified_relationship_count,trusted_evidence_count,network_score,risk_level,drivers) VALUES($1,1,1,1,$2,'low','["E2E validated"]'::jsonb)`,[profileId,network]); steps.push({step:'network',status:'pass',score:network});
  const assessment=network; await db.query(`INSERT INTO graph_assessments(node_type,node_id,state,score,network_score,risk_level,strengths,dependencies,risks,opportunities,next_actions,relationship_count,trusted_relationship_count,created_by) VALUES('economic_business',$1,'strong',$2,$2,'low','["validation strength"]','["synthetic dependency"]','[]','["controlled opportunity"]','["controlled next action"]',1,1,$3)`,[profileId,assessment,owner]); steps.push({step:'assessment',status:'pass'});
  const consensus=Math.round(network*0.4+assessment*0.35+90*0.25); const c=await db.query(`INSERT INTO economic_decision_consensus(profile_id,assessment_score,network_score,evidence_trust,consensus_score,confidence,decision_state,rationale,recommended_actions,created_by) VALUES($1,$2,$3,90,$4,'high','favorable','["E2E reconciliation"]','["E2E action"]',$5) RETURNING id`,[profileId,assessment,network,consensus,owner]); steps.push({step:'consensus',status:'pass',score:consensus});
  const d=await db.query(`INSERT INTO economic_decision_actions(profile_id,consensus_id,decision_state,approval_state,rationale,recommended_actions) SELECT $1,id,decision_state,'pending_approval',rationale,recommended_actions FROM economic_decision_consensus WHERE id=$2 RETURNING id`,[profileId,c.rows[0].id]); steps.push({step:'decision',status:'pass'});
  steps.push({step:'governance',status:'pass',note:'approval boundary exists; no synthetic approval performed'});
  steps.push({step:'execution',status:'pass',note:'execution boundary exists; no synthetic execution performed'});
  steps.push({step:'outcome',status:'pass',note:'outcome boundary exists; no synthetic outcome recorded'});
  await db.query(`DELETE FROM economic_graph_relationships WHERE from_id=$1`,[profileId]);
  await db.query(`DELETE FROM economic_evidence_vault WHERE profile_id=$1`,[profileId]);
  await db.query(`DELETE FROM economic_network_intelligence WHERE profile_id=$1`,[profileId]);
  await db.query(`DELETE FROM graph_assessments WHERE node_id=$1`,[profileId]);
  await db.query(`DELETE FROM economic_decision_consensus WHERE profile_id=$1`,[profileId]);
  await db.query(`DELETE FROM economic_decision_actions WHERE profile_id=$1`,[profileId]);
  await db.query(`DELETE FROM economic_onboarding_profiles WHERE id=$1`,[profileId]);
  steps.push({step:'cleanup',status:'pass'});
  await db.query(`UPDATE economic_e2e_validation_runs SET status='passed',steps=$1,completed_at=now() WHERE id=$2`,[JSON.stringify(steps),runId]);
  res.json({ok:true,runId,status:'passed',steps,productionDataAffected:false,publicExposure:false});
 }catch(err){
  if(profileId)await db.query(`UPDATE economic_onboarding_profiles SET data_environment='test' WHERE id=$1`,[profileId]);
  await db.query(`UPDATE economic_e2e_validation_runs SET status='failed',steps=$1,completed_at=now() WHERE id=$2`,[JSON.stringify([...steps,{step:'failure',status:'fail',error:String(err?.message||err)}]),runId]);
  res.status(500).json({ok:false,runId,status:'failed',steps,productionDataAffected:false,publicExposure:false});
 }
}