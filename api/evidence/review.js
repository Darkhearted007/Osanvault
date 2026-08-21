import { db } from 'hatchable';
export const access='member';
export const methods=['POST'];
const clean=(v,max)=>typeof v==='string'?v.trim().slice(0,max):'';
export default async function(req,res){
 const evidenceId=clean(req.body?.evidenceId,80), action=clean(req.body?.action,30).toLowerCase(), notes=clean(req.body?.notes,2000);
 const trust=req.body?.trustScore===undefined?null:Number(req.body.trustScore);
 if(!evidenceId||!['verify','reject'].includes(action))return res.status(400).json({ok:false,error:'evidenceId and action verify/reject are required.'});
 if(action==='verify'&&(!Number.isFinite(trust)||trust<0||trust>100))return res.status(400).json({ok:false,error:'A trustScore from 0 to 100 is required for verification.'});
 const q=await db.query(`SELECT e.id,e.profile_id,e.title,e.description,e.source_type,p.owner_id,p.data_environment FROM economic_evidence_vault e JOIN economic_onboarding_profiles p ON p.id=e.profile_id WHERE e.id=$1 AND p.data_environment='production' LIMIT 1`,[evidenceId]);
 if(!q.rows.length)return res.status(404).json({ok:false,error:'Evidence not found in a production profile.'});
 const e=q.rows[0];
 if(e.owner_id===req.member.id)return res.status(403).json({ok:false,error:'Independent verification required: the submitter cannot verify their own evidence.'});
 if(e.verification_status!=='submitted')return res.status(409).json({ok:false,error:`Evidence is already ${e.verification_status}.`});
 if(action==='reject'){
  const r=await db.query(`UPDATE economic_evidence_vault SET verification_status='rejected',reviewed_by=$1,reviewed_at=now(),review_notes=$2,updated_at=now() WHERE id=$3 RETURNING id,verification_status,reviewed_by,reviewed_at,review_notes`,[req.member.id,notes,evidenceId]);
  return res.json({ok:true,evidence:r.rows[0],trustedSignalCreated:false,publicExposure:false,next:'evidence_resubmission'});
 }
 const r=await db.query(`UPDATE economic_evidence_vault SET verification_status='verified',trust_score=$1,reviewed_by=$2,reviewed_at=now(),review_notes=$3,updated_at=now() WHERE id=$4 RETURNING id,verification_status,trust_score,reviewed_by,reviewed_at,review_notes`,[trust,req.member.id,notes,evidenceId]);
 const s=await db.query(`INSERT INTO economic_trusted_evidence_signals(evidence_id,profile_id,signal_type,signal_score,signal_summary,source_verification_score,created_by) VALUES($1,$2,'verified_evidence',$3,$4,$3,$5) RETURNING id,evidence_id,signal_type,signal_score,signal_summary,source_verification_score,created_at`,[evidenceId,e.profile_id,trust,`Verified evidence: ${e.title}`,req.member.id]);
 res.json({ok:true,evidence:r.rows[0],trustedSignal:s.rows[0],trustedSignalCreated:true,publicExposure:false,next:'signal_aggregation'});
}