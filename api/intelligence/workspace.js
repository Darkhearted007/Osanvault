import { db } from 'hatchable';
export const access='member';
export const methods=['GET'];
export default async function(req,res){
 res.setHeader('Cache-Control','no-store, no-cache, must-revalidate, proxy-revalidate');
 res.setHeader('Pragma','no-cache');
 res.setHeader('Expires','0');
 const owner=req.member.id;
 const p=await db.query(`SELECT id,display_name FROM economic_onboarding_profiles WHERE owner_id=$1 AND data_environment='production' ORDER BY created_at DESC NULLS LAST,id DESC`,[owner]);
 const profiles=p.rows;
 if(!profiles.length)return res.json({profiles:[],summary:{profiles:0,relationships:0,verifiedRelationships:0,evidence:0,assessments:0,consensus:0,averageConsensus:null},readiness:'GREEN',source:'live_database'});
 const r=await db.query(`SELECT COUNT(*)::int AS total,COUNT(*) FILTER(WHERE r.status='verified')::int AS verified FROM economic_graph_relationships r JOIN economic_onboarding_profiles p ON p.id=r.from_id WHERE p.owner_id=$1 AND p.data_environment='production'`,[owner]);
 const e=await db.query(`SELECT COUNT(*)::int AS total FROM economic_evidence_vault e JOIN economic_onboarding_profiles p ON p.id=e.profile_id WHERE p.owner_id=$1 AND p.data_environment='production'`,[owner]);
 const a=await db.query(`SELECT COUNT(*)::int AS total FROM graph_assessments a JOIN economic_onboarding_profiles p ON p.id=a.node_id WHERE a.node_type='economic_business' AND p.owner_id=$1 AND p.data_environment='production'`,[owner]);
 const c=await db.query(`SELECT COUNT(*)::int AS total,AVG(c.consensus_score)::numeric AS avg_score FROM economic_consensus_reconciliation_runs c JOIN economic_onboarding_profiles p ON p.id=c.profile_id WHERE p.owner_id=$1 AND p.data_environment='production'`,[owner]);
 res.json({profiles:profiles.map(x=>({id:x.id,name:x.display_name})),summary:{profiles:profiles.length,relationships:r.rows[0].total,verifiedRelationships:r.rows[0].verified,evidence:e.rows[0].total,assessments:a.rows[0].total,consensus:Number(c.rows[0].total||0),averageConsensus:c.rows[0].avg_score?Number(c.rows[0].avg_score):null},readiness:'GREEN',source:'live_database'});
}