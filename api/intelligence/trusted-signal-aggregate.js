import { db } from 'hatchable';
export const access='member';
export const methods=['POST'];
const clean=v=>typeof v==='string'?v.trim().slice(0,80):'';
export default async function(req,res){
 const profileId=clean(req.body?.profileId);
 if(!profileId)return res.status(400).json({ok:false,error:'profileId is required.'});
 const p=await db.query(`SELECT id,display_name FROM economic_onboarding_profiles WHERE id=$1 AND owner_id=$2 AND data_environment='production' LIMIT 1`,[profileId,req.member.id]);
 if(!p.rows.length)return res.status(404).json({ok:false,error:'Production profile not found.'});
 const s=await db.query(`SELECT id,signal_type,signal_score,source_verification_score FROM economic_trusted_evidence_signals WHERE profile_id=$1 ORDER BY created_at DESC`,[profileId]);
 const rows=s.rows, count=rows.length;
 if(!count)return res.status(409).json({ok:false,error:'No trusted evidence signals are available for aggregation.'});
 const average=rows.reduce((a,r)=>a+Number(r.signal_score||0),0)/count;
 const weighted=rows.reduce((a,r)=>a+(Number(r.signal_score||0)*Math.max(0,Math.min(100,Number(r.source_verification_score||0)))/100),0)/count;
 const confidence=weighted>=80?'high':weighted>=55?'moderate':'low';
 const types=[...new Set(rows.map(r=>r.signal_type))], ids=rows.map(r=>r.id);
 const r=await db.query(`INSERT INTO economic_trusted_signal_aggregates(profile_id,signal_count,average_signal_score,weighted_score,confidence,signal_types,source_ids,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id,profile_id AS "profileId",signal_count AS "signalCount",average_signal_score AS "averageSignalScore",weighted_score AS "weightedScore",confidence,signal_types AS "signalTypes",source_ids AS "sourceIds",created_at AS "createdAt"`,[profileId,count,average,weighted,confidence,JSON.stringify(types),JSON.stringify(ids),req.member.id]);
 res.status(201).json({ok:true,profile:p.rows[0],aggregate:r.rows[0],publicExposure:false,next:'network_intelligence'});
}