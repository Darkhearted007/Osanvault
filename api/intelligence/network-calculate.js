import { db } from 'hatchable';
export const access='member';
export const methods=['POST'];
const clean=v=>typeof v==='string'?v.trim().slice(0,80):'';
export default async function(req,res){
 const profileId=clean(req.body?.profileId);
 if(!profileId)return res.status(400).json({ok:false,error:'profileId is required.'});
 const p=await db.query(`SELECT id FROM economic_onboarding_profiles WHERE id=$1 AND owner_id=$2 AND data_environment='production' LIMIT 1`,[profileId,req.member.id]);
 if(!p.rows.length)return res.status(404).json({ok:false,error:'Production profile not found.'});
 const rel=await db.query(`SELECT COUNT(*)::int AS total,COUNT(*) FILTER(WHERE r.status='verified')::int AS verified,COALESCE(AVG(r.confidence),0)::numeric AS avg_confidence FROM economic_graph_relationships r WHERE r.from_id=$1`,[profileId]);
 const ev=await db.query(`SELECT COUNT(*)::int AS total,COALESCE(AVG(trust_score),0)::numeric AS avg_trust FROM economic_evidence_vault WHERE profile_id=$1 AND verification_status='verified'`,[profileId]);
 const m=rel.rows[0],e=ev.rows[0];
 const relationshipStrength=Number(m.total)?(Number(m.verified)/Number(m.total))*100:0;
 const confidence=Math.min(100,Number(m.avg_confidence)*100);
 const evidenceTrust=Math.min(100,Number(e.total)?Number(e.avg_trust):0);
 const score=Math.round((relationshipStrength*0.5)+(confidence*0.2)+(evidenceTrust*0.3));
 const risk=score>=75?'low':score>=50?'moderate':score>=25?'elevated':'high';
 const drivers=[];
 if(Number(m.verified)>0)drivers.push('verified relationships strengthen network trust');
 if(Number(e.total)>0)drivers.push('verified evidence contributes to network confidence');
 if(Number(m.total)>Number(m.verified))drivers.push('unverified relationships reduce network certainty');
 if(!Number(e.total))drivers.push('no verified evidence currently contributes to trust');
 const r=await db.query(`INSERT INTO economic_network_intelligence(profile_id,relationship_count,verified_relationship_count,trusted_evidence_count,network_score,risk_level,drivers) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id,network_score AS "networkScore",risk_level AS "riskLevel",drivers,calculated_at AS "calculatedAt"`,[profileId,m.total,m.verified,e.total,score,risk,JSON.stringify(drivers)]);
 res.status(201).json({ok:true,intelligence:r.rows[0],inputs:{relationships:m.total,verifiedRelationships:m.verified,verifiedEvidence:e.total},formula:'50% relationship verification + 20% relationship confidence + 30% verified evidence trust',next:'assessment'});
}