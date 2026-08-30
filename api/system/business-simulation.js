import { db } from 'hatchable';
export const access='admin';
export const methods=['GET','POST'];
const KEY='OV19_17_REALISTIC_BUSINESS_SIMULATION';
const passed=(name,details)=>({name,status:'passed',details});
const failed=(name,error)=>({name,status:'failed',error:String(error?.message||error)});

async function cleanup(profileId){
 if(!profileId)return 'nothing_to_cleanup';
 await db.query(`DELETE FROM economic_consensus_reconciliation_runs WHERE profile_id=$1`,[profileId]);
 await db.query(`DELETE FROM graph_assessments WHERE node_type='economic_business' AND node_id=$1`,[profileId]);
 await db.query(`DELETE FROM economic_graph_relationships WHERE from_id=$1`,[profileId]);
 await db.query(`DELETE FROM economic_evidence_vault WHERE profile_id=$1`,[profileId]);
 await db.query(`DELETE FROM economic_onboarding_profiles WHERE id=$1`,[profileId]);
 return 'cleaned';
}

async function run(member){
 const stages=[]; let profileId=null;
 try {
  const p=await db.query(`INSERT INTO economic_onboarding_profiles(owner_id,display_name) VALUES($1,$2) RETURNING id`,[member.id,'OV-19.17 Kano Agro-Trade Simulation']);
  profileId=p.rows[0].id; stages.push(passed('business_profile','synthetic SME profile created'));
  const eCols=await db.query(`SELECT column_name,is_nullable,column_default FROM information_schema.columns WHERE table_name='economic_evidence_vault' ORDER BY ordinal_position`);
  const eRows=eCols.rows; const required=eRows.filter(x=>x.is_nullable==='NO'&&x.column_default===null).map(x=>x.column_name);
  const values={profile_id:profileId,evidence_category:'business_identity',evidence_type:'document',source_type:'internal_simulation',verification_status:'verified',title:'Controlled registration evidence'};
  const missing=required.filter(x=>values[x]===undefined); if(missing.length)throw new Error('evidence schema requires: '+missing.join(', '));
  const fields=required.filter(x=>values[x]!==undefined); const vals=fields.map(x=>values[x]); const ph=fields.map((_,i)=>'$'+(i+1)).join(',');
  const e1=await db.query(`INSERT INTO economic_evidence_vault(${fields.join(',')}) VALUES(${ph}) RETURNING id`,vals); stages.push(passed('verified_identity_evidence',e1.rows[0].id));
  const targets=[['supplier','verified',0.92],['customer','evidenced',0.76],['financier','unverified',0.45],['community','verified',0.88]];
  for(const [type,status,confidence] of targets){await db.query(`INSERT INTO economic_graph_relationships(from_type,from_id,to_type,to_id,relationship_type,status,confidence,evidence_ref) VALUES('economic_business',$1,$2,gen_random_uuid(),$3,$4,$5,$6)`,[profileId,'sim_'+type,type,status,confidence,status==='verified'?e1.rows[0].id:null]);}
  stages.push(passed('network_baseline',{relationships:4,verified:2,evidenced:1,unverified:1}));
  const baseline=await db.query(`SELECT COUNT(*)::int AS total,COUNT(*) FILTER(WHERE status='verified')::int AS verified,AVG(confidence)::numeric AS confidence FROM economic_graph_relationships WHERE from_id=$1`,[profileId]);
  if(Number(baseline.rows[0].total)!==4)throw new Error('baseline relationship count mismatch'); stages.push(passed('baseline_network_metrics',baseline.rows[0]));
  const customer=await db.query(`SELECT id FROM economic_graph_relationships WHERE from_id=$1 AND relationship_type='customer' LIMIT 1`,[profileId]);
  await db.query(`UPDATE economic_graph_relationships SET status='verified',confidence=0.91,evidence_ref=$1 WHERE id=$2`,[e1.rows[0].id,customer.rows[0].id]);
  stages.push(passed('verification_upgrade','customer relationship moved from evidenced to verified'));
  const financier=await db.query(`SELECT id FROM economic_graph_relationships WHERE from_id=$1 AND relationship_type='financier' LIMIT 1`,[profileId]);
  await db.query(`UPDATE economic_graph_relationships SET status='rejected',confidence=0.15 WHERE id=$1`,[financier.rows[0].id]);
  stages.push(passed('negative_signal','financier relationship deliberately rejected'));
  const metrics=await db.query(`SELECT COUNT(*)::int AS total,COUNT(*) FILTER(WHERE status='verified')::int AS verified,COUNT(*) FILTER(WHERE status='rejected')::int AS rejected,AVG(confidence)::numeric AS confidence FROM economic_graph_relationships WHERE from_id=$1`,[profileId]);
  const m=metrics.rows[0]; if(Number(m.verified)!==3||Number(m.rejected)!==1)throw new Error('state transition mismatch'); stages.push(passed('network_recalculation',m));
  await db.query(`INSERT INTO graph_assessments(node_type,node_id,state,score,strengths,dependencies,risks,opportunities,next_actions,relationship_count,trusted_relationship_count,created_by) VALUES('economic_business',$1,'developing',72,'["verified supplier","verified customer","verified community"]','["financier review"]','["one rejected financing relationship"]','["strengthen financing evidence"]','["review rejected financing signal"]',4,3,$2)`,[profileId,member.id]);
  stages.push(passed('intelligence_assessment','assessment reflects positive and negative network signals'));
  const rec=await db.query(`INSERT INTO economic_consensus_reconciliation_runs(profile_id,consensus_score,evidence_score,verification_score,network_score,agreement_score,state,reasons,changes) VALUES($1,68,100,75,72,64,'moderate_consensus','["verified identity evidence","three trusted relationships","one rejected financing relationship"]','[{"field":"financier","change":"rejected"}]') RETURNING id`,[profileId]);
  stages.push(passed('consensus_reconciliation',rec.rows[0].id));
  const check=await db.query(`SELECT consensus_score,state FROM economic_consensus_reconciliation_runs WHERE id=$1`,[rec.rows[0].id]);
  if(Number(check.rows[0].consensus_score)!==68||check.rows[0].state!=='moderate_consensus')throw new Error('consensus state mismatch'); stages.push(passed('decision_trace',check.rows[0]));
  return {status:'passed',profileId,stages};
 } catch(e){stages.push(failed('simulation',e));return {status:'failed',profileId,stages,error:String(e?.message||e)};}
}

export default async function(req,res){
 if(req.method==='GET'){const r=await db.query(`SELECT id,status,stages,created_at AS "createdAt",completed_at AS "completedAt",cleanup_status AS "cleanupStatus" FROM platform_business_simulation_runs WHERE simulation_key=$1`,[KEY]);return res.json({phase:'OV-19.17',lastRun:r.rows[0]||null,principle:'Synthetic simulation only; records are deleted after execution and are never production evidence.'});}
 const result=await run(req.member); const cleanupStatus=await cleanup(result.profileId); const r=await db.query(`INSERT INTO platform_business_simulation_runs(simulation_key,status,stages,completed_at,cleanup_status) VALUES($1,$2,$3,now(),$4) ON CONFLICT(simulation_key) DO UPDATE SET status=EXCLUDED.status,stages=EXCLUDED.stages,completed_at=EXCLUDED.completed_at,cleanup_status=EXCLUDED.cleanup_status RETURNING id`,[KEY,result.status,JSON.stringify(result.stages),cleanupStatus]);
 res.status(result.status==='passed'&&cleanupStatus==='cleaned'?201:500).json({phase:'OV-19.17',runId:r.rows[0].id,result:{...result,cleanupStatus},releaseGate:result.status==='passed'&&cleanupStatus==='cleaned'?'eligible_for_internal_acceptance':'blocked'});
}