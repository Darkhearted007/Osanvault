import { db } from 'hatchable';
export const access='member';
export const methods=['GET'];
export default async function(req,res){
 const owner=req.member.id;
 const p=await db.query(`SELECT id,display_name FROM economic_onboarding_profiles WHERE owner_id=$1 ORDER BY id DESC`,[owner]);
 const profiles=p.rows;
 const profileIds=profiles.map(x=>x.id);
 if(!profileIds.length)return res.json({profiles:[],summary:{profiles:0,relationships:0,evidence:0,assessments:0,consensus:0},readiness:'GREEN'});
 const r=await db.query(`SELECT COUNT(*)::int AS total,COUNT(*) FILTER(WHERE r.status='verified')::int AS verified FROM economic_graph_relationships r JOIN economic_onboarding_profiles p ON p.id=r.from_id WHERE p.owner_id=$1`,[owner]);
 const e=await db.query(`SELECT COUNT(*)::int AS total FROM economic_evidence_vault e JOIN economic_onboarding_profiles p ON p.id=e.profile_id WHERE p.owner_id=$1`,[owner]);
 const a=await db.query(`SELECT COUNT(*)::int AS total FROM graph_assessments a JOIN economic_onboarding_profiles p ON p.id=a.node_id WHERE p.owner_id=$1`,[owner]);
 const c=await db.query(`SELECT COUNT(*)::int AS total,AVG(c.consensus_score)::numeric AS avg_score FROM economic_consensus_reconciliation_runs c JOIN economic_onboarding_profiles p ON p.id=c.profile_id WHERE p.owner_id=$1`,[owner]);
 const detail=profiles.map(x=>({id:x.id,name:x.display_name}));
 res.json({profiles:detail,summary:{profiles:profiles.length,relationships:r.rows[0].total,verifiedRelationships:r.rows[0].verified,evidence:e.rows[0].total,assessments:a.rows[0].total,consensus:Number(c.rows[0].total||0),averageConsensus:c.rows[0].avg_score?Number(c.rows[0].avg_score):null},readiness:'GREEN'});
}