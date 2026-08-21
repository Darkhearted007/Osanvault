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
 if(!n.rows.length)return res.status(409).json({ok:false,error:'Explainable network intelligence is required before assessment.'});
 const x=n.rows[0]; const score=Number(x.network_score||0); const assessment=Math.round(score); const drivers=Array.isArray(x.drivers)?x.drivers:[];
 const explanation=`Assessment score ${assessment}/100 inherits the explainable network intelligence score and remains traceable to its verified evidence signals.`;
 const r=await db.query(`INSERT INTO economic_explainable_assessments(profile_id,network_intelligence_id,assessment_score,confidence,drivers,source_signal_ids,explanation,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id,profile_id AS "profileId",network_intelligence_id AS "networkIntelligenceId",assessment_score AS "assessmentScore",confidence,drivers,source_signal_ids AS "sourceSignalIds",explanation,created_at AS "createdAt"`,[profileId,x.id,assessment,x.confidence,JSON.stringify(drivers),JSON.stringify(x.source_signal_ids||[]),explanation,req.member.id]);
 res.status(201).json({ok:true,profile:p.rows[0],assessment:r.rows[0],publicExposure:false,next:'explainable_consensus'});
}