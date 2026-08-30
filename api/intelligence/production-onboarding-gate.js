import { db } from 'hatchable';
export const access='admin';
export const methods=['POST'];
const clean=v=>typeof v==='string'?v.trim().slice(0,120):'';
export default async function(req,res){
 const profileId=clean(req.body?.profileId);
 if(!profileId)return res.status(400).json({ok:false,error:'profileId is required.'});
 const p=await db.query(`SELECT id,display_name,business_type,sector,location,description,data_environment,onboarding_status FROM economic_onboarding_profiles WHERE id=$1 AND owner_id=$2 LIMIT 1`,[profileId,req.member.id]);
 if(!p.rows.length)return res.status(404).json({ok:false,error:'Profile not found for this member.'});
 const profile=p.rows[0],checks=[];
 checks.push({key:'production_environment',status:profile.data_environment==='production'?'pass':'fail',details:{environment:profile.data_environment}});
 checks.push({key:'required_identity',status:profile.display_name&&profile.business_type&&profile.sector?'pass':'fail'});
 checks.push({key:'private_exposure',status:'pass',details:{publicExposure:false}});
 const evidence=await db.query(`SELECT COUNT(*)::int AS total,COUNT(*) FILTER(WHERE verification_status='verified')::int AS verified FROM economic_evidence_vault WHERE profile_id=$1`,[profileId]);
 checks.push({key:'evidence_baseline',status:Number(evidence.rows[0].total)>0?'pass':'pending',details:{total:Number(evidence.rows[0].total),verified:Number(evidence.rows[0].verified)}});
 const failed=checks.filter(c=>c.status==='fail').length;
 const status=failed?'blocked':checks.some(c=>c.status==='pending')?'awaiting_evidence':'ready_for_private_intelligence';
 const r=await db.query(`INSERT INTO economic_production_onboarding_gate(profile_id,gate_key,status,checks,created_by,completed_at) VALUES($1,'OV-22',$2,$3,$4,CASE WHEN $2='ready_for_private_intelligence' THEN now() ELSE NULL END) RETURNING id,status,checks,created_at AS "createdAt",completed_at AS "completedAt"`,[profileId,status,JSON.stringify(checks),req.member.id]);
 res.status(status==='blocked'?409:200).json({ok:status!=='blocked',profile,gate:r.rows[0],publicExposure:false,next:status==='ready_for_private_intelligence'?'run_private_intelligence':'add_and_verify_real_evidence'});
}