import { db } from 'hatchable';
export const access='member';
export const methods=['POST'];
const clean=v=>typeof v==='string'?v.trim().slice(0,80):'';
export default async function(req,res){
 const profileId=clean(req.body?.profileId);
 if(!profileId)return res.status(400).json({ok:false,error:'profileId is required.'});
 const p=await db.query(`SELECT id,display_name FROM economic_onboarding_profiles WHERE id=$1 AND owner_id=$2 AND data_environment='production' LIMIT 1`,[profileId,req.member.id]);
 if(!p.rows.length)return res.status(404).json({ok:false,error:'Production profile not found.'});
 const a=await db.query(`SELECT id,signal_count,average_signal_score,weighted_score,confidence,signal_types,source_ids FROM economic_trusted_signal_aggregates WHERE profile_id=$1 ORDER BY created_at DESC LIMIT 1`,[profileId]);
 if(!a.rows.length)return res.status(409).json({ok:false,error:'Trusted signal aggregation is required before provenance can be generated.'});
 const x=a.rows[0]; const ids=Array.isArray(x.source_ids)?x.source_ids:[]; const types=Array.isArray(x.signal_types)?x.signal_types:[];
 const explanation=`Profile intelligence is based on ${x.signal_count} verified evidence signal(s), producing a verification-weighted score of ${Number(x.weighted_score).toFixed(2)} with ${x.confidence} confidence.`;
 const breakdown=types.map((type,i)=>({signalType:type,sourceSignalId:ids[i]||null,contribution:'included_in_verified_signal_aggregate'}));
 const r=await db.query(`INSERT INTO economic_intelligence_provenance(profile_id,aggregate_id,explanation,contribution_breakdown,source_signal_ids,confidence,created_by) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id,profile_id AS "profileId",aggregate_id AS "aggregateId",explanation,contribution_breakdown AS "contributionBreakdown",source_signal_ids AS "sourceSignalIds",confidence,created_at AS "createdAt"`,[profileId,x.id,explanation,JSON.stringify(breakdown),JSON.stringify(ids),x.confidence,req.member.id]);
 res.status(201).json({ok:true,profile:p.rows[0],provenance:r.rows[0],publicExposure:false,next:'explainable_network_intelligence'});
}