import { db } from 'hatchable';
export const access='member';
export const methods=['POST'];
const clean=v=>typeof v==='string'?v.trim().slice(0,80):'';
export default async function(req,res){
 const profileId=clean(req.body?.profileId);
 if(!profileId)return res.status(400).json({ok:false,error:'profileId is required.'});
 const p=await db.query(`SELECT id,display_name FROM economic_onboarding_profiles WHERE id=$1 AND owner_id=$2 AND data_environment='production' LIMIT 1`,[profileId,req.member.id]);
 if(!p.rows.length)return res.status(404).json({ok:false,error:'Production profile not found.'});
 const a=await db.query(`SELECT id,weighted_score,confidence,source_ids,signal_count FROM economic_trusted_signal_aggregates WHERE profile_id=$1 ORDER BY created_at DESC LIMIT 1`,[profileId]);
 if(!a.rows.length)return res.status(409).json({ok:false,error:'Trusted signal aggregation is required before network intelligence.'});
 const x=a.rows[0];
 const provenance=await db.query(`SELECT id FROM economic_intelligence_provenance WHERE aggregate_id=$1 ORDER BY created_at DESC LIMIT 1`,[x.id]);
 const score=Math.round(Number(x.weighted_score||0));
 const drivers=[];
 if(score>=80)drivers.push('Strong verified evidence signal quality.');
 else if(score>=55)drivers.push('Moderate verified evidence signal quality.');
 else drivers.push('Weak verified evidence signal quality; additional verification is recommended.');
 drivers.push(`${Number(x.signal_count)} verified evidence signal(s) contributed to the network picture.`);
 const explanation=`Network intelligence score ${score}/100 is derived from the latest verification-weighted trusted evidence aggregate with ${x.confidence} confidence.`;
 const r=await db.query(`INSERT INTO economic_explainable_network_intelligence(profile_id,aggregate_id,provenance_id,network_score,confidence,drivers,source_signal_ids,explanation,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id,profile_id AS "profileId",aggregate_id AS "aggregateId",provenance_id AS "provenanceId",network_score AS "networkScore",confidence,drivers,source_signal_ids AS "sourceSignalIds",explanation,created_at AS "createdAt"`,[profileId,x.id,provenance.rows[0]?.id||null,score,x.confidence,JSON.stringify(drivers),JSON.stringify(x.source_ids||[]),explanation,req.member.id]);
 res.status(201).json({ok:true,profile:p.rows[0],network:r.rows[0],publicExposure:false,next:'explainable_assessment'});
}