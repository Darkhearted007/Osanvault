import { db } from 'hatchable';
export const access='member';
export const methods=['POST'];
const clean=v=>typeof v==='string'?v.trim().slice(0,80):'';
export default async function(req,res){
 const profileId=clean(req.body?.profileId);
 if(!profileId)return res.status(400).json({ok:false,error:'profileId is required.'});
 const p=await db.query(`SELECT id,display_name,business_type,sector,location,description FROM economic_onboarding_profiles WHERE id=$1 AND owner_id=$2 AND data_environment='production' LIMIT 1`,[profileId,req.member.id]);
 if(!p.rows.length)return res.status(404).json({ok:false,error:'Production profile not found.'});
 const n=await db.query(`SELECT network_score,risk_level,drivers,calculated_at FROM economic_network_intelligence WHERE profile_id=$1 ORDER BY calculated_at DESC LIMIT 1`,[profileId]);
 if(!n.rows.length)return res.status(409).json({ok:false,error:'Calculate network intelligence before creating an assessment.'});
 const x=n.rows[0],score=Number(x.network_score||0);
 const strengths=[],risks=[],dependencies=[],opportunities=[],actions=[];
 if(score>=75)strengths.push('Strong trusted economic network signal.');
 else if(score>=50)strengths.push('Moderate network trust with room for strengthening.');
 else risks.push('Network trust is currently below the strong-confidence threshold.');
 if(Number(x.network_score)>=50)opportunities.push('Use verified relationships to strengthen market and financing readiness.');
 if(x.risk_level==='high'||x.risk_level==='elevated')risks.push('Increase verified counterparties and trusted evidence before relying on the network for high-impact decisions.');
 dependencies.push('Assessment depends on the latest verified relationships and trusted evidence.');
 actions.push('Review unverified relationships and obtain stronger supporting evidence.');
 if(score>=75)actions.push('Maintain verification quality as the network expands.');
 const state=score>=75?'strong':score>=50?'developing':'needs_attention';
 const r=await db.query(`INSERT INTO graph_assessments(node_type,node_id,state,score,network_score,risk_level,strengths,dependencies,risks,opportunities,next_actions,relationship_count,trusted_relationship_count,created_by) SELECT 'economic_business',$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,COUNT(r.id),COUNT(r.id) FILTER(WHERE r.status='verified'),$11 FROM economic_graph_relationships r WHERE r.from_id=$1 RETURNING id,state,score,network_score AS "networkScore",risk_level AS "riskLevel",strengths,dependencies,risks,opportunities,next_actions AS "nextActions",created_at AS "createdAt"`,[profileId,state,score,score,x.risk_level,JSON.stringify(strengths),JSON.stringify(dependencies),JSON.stringify(risks),JSON.stringify(opportunities),JSON.stringify(actions),req.member.id]);
 res.status(201).json({ok:true,profile:p.rows[0],assessment:r.rows[0],source:'latest_network_intelligence',next:'consensus'});
}