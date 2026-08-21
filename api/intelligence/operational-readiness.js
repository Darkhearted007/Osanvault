import { db } from 'hatchable';
export const access='member';
export const methods=['GET'];
export default async function(req,res){
 const profileId=typeof req.query?.profileId==='string'?req.query.profileId.trim():'';
 const owner=req.member.id; const checks=[];
 const p=profileId?await db.query(`SELECT id,display_name,data_environment,onboarding_status FROM economic_onboarding_profiles WHERE id=$1 AND owner_id=$2 LIMIT 1`,[profileId,owner]):{rows:[]};
 checks.push({key:'production_profile',status:p.rows.length&&p.rows[0].data_environment==='production'?'pass':'pending',details:p.rows[0]||null});
 if(p.rows.length){
  const id=p.rows[0].id;
  const evidence=await db.query(`SELECT COUNT(*)::int total,COUNT(*) FILTER(WHERE verification_status='verified')::int verified FROM economic_evidence_vault WHERE profile_id=$1`,[id]);
  const signals=await db.query(`SELECT COUNT(*)::int total FROM economic_trusted_evidence_signals WHERE profile_id=$1`,[id]);
  const agg=await db.query(`SELECT COUNT(*)::int total FROM economic_trusted_signal_aggregates WHERE profile_id=$1`,[id]);
  const network=await db.query(`SELECT COUNT(*)::int total FROM economic_explainable_network_intelligence WHERE profile_id=$1`,[id]);
  const assess=await db.query(`SELECT COUNT(*)::int total FROM economic_explainable_assessments WHERE profile_id=$1`,[id]);
  const consensus=await db.query(`SELECT COUNT(*)::int total FROM economic_explainable_consensus WHERE profile_id=$1`,[id]);
  const decisions=await db.query(`SELECT COUNT(*)::int total FROM economic_explainable_decisions WHERE profile_id=$1`,[id]);
  checks.push({key:'verified_evidence',status:Number(evidence.rows[0].verified)>0?'pass':'pending',details:evidence.rows[0]});
  checks.push({key:'trusted_signals',status:Number(signals.rows[0].total)>0?'pass':'pending',details:signals.rows[0]});
  checks.push({key:'signal_aggregation',status:Number(agg.rows[0].total)>0?'pass':'pending',details:agg.rows[0]});
  checks.push({key:'network_intelligence',status:Number(network.rows[0].total)>0?'pass':'pending',details:network.rows[0]});
  checks.push({key:'assessment',status:Number(assess.rows[0].total)>0?'pass':'pending',details:assess.rows[0]});
  checks.push({key:'consensus',status:Number(consensus.rows[0].total)>0?'pass':'pending',details:consensus.rows[0]});
  checks.push({key:'decision',status:Number(decisions.rows[0].total)>0?'pass':'pending',details:decisions.rows[0]});
 }
 const failed=checks.filter(c=>c.status==='fail').length, pending=checks.filter(c=>c.status==='pending').length; const status=failed?'failed':pending?'not_ready':'ready_private';
 const r=await db.query(`INSERT INTO economic_operational_readiness_runs(profile_id,run_key,status,checks,public_exposure,production_data_affected,created_by,completed_at) VALUES($1,$2,$3,$4,false,false,$5,now()) RETURNING id,status,checks,public_exposure AS "publicExposure",production_data_affected AS "productionDataAffected",created_at AS "createdAt",completed_at AS "completedAt"`,[p.rows[0]?.id||null,`OV219-${Date.now()}`,status,JSON.stringify(checks),owner]);
 res.json({ok:true,status,checks,run:r.rows[0],publicExposure:false,productionDataAffected:false,next:status==='ready_private'?'private_operating_dashboard':'complete_missing_readiness_items'});
}