import { db } from 'hatchable';
export const access='member';
export const methods=['POST'];
const clean=(v,max)=>typeof v==='string'?v.trim().slice(0,max):'';
export default async function(req,res){
 const evidenceId=clean(req.body?.evidenceId,80), decision=clean(req.body?.decision,30).toLowerCase(), notes=clean(req.body?.reviewNotes,2000);
 const score=Number(req.body?.trustScore);
 if(!evidenceId||!['verify','reject','review'].includes(decision))return res.status(400).json({ok:false,error:'evidenceId and decision verify/reject/review are required.'});
 if((decision==='verify'||decision==='reject')&&(!Number.isFinite(score)||score<0||score>100))return res.status(400).json({ok:false,error:'trustScore between 0 and 100 is required for verify/reject.'});
 const q=await db.query(`SELECT e.id,e.profile_id,e.verification_status,p.owner_id,p.data_environment FROM economic_evidence_vault e JOIN economic_onboarding_profiles p ON p.id=e.profile_id WHERE e.id=$1 AND p.owner_id=$2 AND p.data_environment='production' LIMIT 1`,[evidenceId,req.member.id]);
 if(!q.rows.length)return res.status(404).json({ok:false,error:'Evidence not found in an owned production profile.'});
 const e=q.rows[0];
 if(!['submitted','reviewed'].includes(e.verification_status))return res.status(409).json({ok:false,error:`Evidence cannot be reviewed from status ${e.verification_status}.`});
 const next=decision==='verify'?'verified':decision==='reject'?'rejected':'reviewed';
 const u=await db.query(`UPDATE economic_evidence_vault SET verification_status=$1,trust_score=$2,verified_by=$3,verified_at=CASE WHEN $4='verified' THEN now() ELSE NULL END,review_notes=$5 WHERE id=$6 RETURNING id,title,verification_status AS "verificationStatus",trust_score AS "trustScore",verified_by AS "verifiedBy",verified_at AS "verifiedAt",review_notes AS "reviewNotes"`,[next,Number.isFinite(score)?score:null,req.member.id,next,notes,evidenceId]);
 await db.query(`INSERT INTO economic_evidence_verification_events(evidence_id,profile_id,from_status,to_status,reviewer_id,trust_score,review_notes) VALUES($1,$2,$3,$4,$5,$6,$7)`,[evidenceId,e.profile_id,e.verification_status,next,req.member.id,Number.isFinite(score)?score:null,notes]);
 res.json({ok:true,evidence:u.rows[0],audit:{from:e.verification_status,to:next,reviewer:req.member.id},publicExposure:false,next:next==='verified'?'trusted_intelligence':'evidence_review'});
}