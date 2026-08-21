import { db } from 'hatchable';
export const access='member';
export const methods=['POST'];
const clean=v=>typeof v==='string'?v.trim().slice(0,80):'';
export default async function(req,res){
 const profileId=clean(req.body?.profileId);
 if(!profileId)return res.status(400).json({ok:false,error:'profileId is required.'});
 const p=await db.query(`SELECT id,display_name FROM economic_onboarding_profiles WHERE id=$1 AND owner_id=$2 AND data_environment='production' LIMIT 1`,[profileId,req.member.id]);
 if(!p.rows.length)return res.status(404).json({ok:false,error:'Production profile not found.'});
 const n=await db.query(`SELECT id,network_score,confidence,drivers,source_signal_ids FROM economic_explainable_network_intelligence WHERE profile_id=$1 ORDER BY created_at DESC LIMIT 1`,[profileId]);
 const a=await db.query(`SELECT id,assessment_score,confidence,drivers,source_signal_ids FROM economic_explainable_assessments WHERE profile_id=$1 ORDER BY created_at DESC LIMIT 1`,[profileId]);
 if(!n.rows.length||!a.rows.length)return res.status(409).json({ok:false,error:'Explainable network intelligence and assessment are required before consensus.'});
 const x=n.rows[0], y=a.rows[0]; const score=Math.round(Number(x.network_score||0)*0.5+Number(y.assessment_score||0)*0.5);
 const confidence=x.confidence==='high'&&y.confidence==='high'?'high':(x.confidence==='low'||y.confidence==='low'?'low':'moderate');
 const state=score>=75?'favorable':score>=50?'conditional':'unfavorable';
 const drivers=[...(Array.isArray(x.drivers)?x.drivers:[]),...(Array.isArray(y.drivers)?y.drivers:[])];
 const sourceIds=[...new Set([...(Array.isArray(x.source_signal_ids)?x.source_signal_ids:[]),...(Array.isArray(y.source_signal_ids)?y.source_signal_ids:[])])];
 const explanation=`Consensus score ${score}/100 combines explainable network intelligence and explainable assessment, preserving traceability to verified evidence signals. Decision state: ${state}.`;
 const r=await db.query(`INSERT INTO economic_explainable_consensus(profile_id,network_intelligence_id,assessment_id,consensus_score,confidence,decision_state,drivers,source_signal_ids,explanation,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id,profile_id AS "profileId",network_intelligence_id AS "networkIntelligenceId",assessment_id AS "assessmentId",consensus_score AS "consensusScore",confidence,decision_state AS "decisionState",drivers,source_signal_ids AS "sourceSignalIds",explanation,created_at AS "createdAt"`,[profileId,x.id,y.id,score,confidence,state,JSON.stringify(drivers),JSON.stringify(sourceIds),explanation,req.member.id]);
 res.status(201).json({ok:true,profile:p.rows[0],consensus:r.rows[0],publicExposure:false,next:'governed_decision'});
}