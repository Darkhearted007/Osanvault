import { db } from 'hatchable';
export const access='member';
export const methods=['POST'];
const clean=(v,max)=>typeof v==='string'?v.trim().slice(0,max):'';
export default async function(req,res){
 const body=req.body||{};
 const evidenceId=clean(body.evidenceId,80), decision=clean(body.decision,20).toLowerCase(), notes=clean(body.notes,1200);
 const score=Number(body.trustScore);
 if(!evidenceId||!['verified','rejected'].includes(decision))return res.status(400).json({ok:false,error:'evidenceId and a verified/rejected decision are required.'});
 if(!Number.isFinite(score)||score<0||score>100)return res.status(400).json({ok:false,error:'trustScore must be between 0 and 100.'});
 const r=await db.query(`SELECT e.id,e.profile_id,p.owner_id FROM economic_evidence_vault e JOIN economic_onboarding_profiles p ON p.id=e.profile_id WHERE e.id=$1 AND p.owner_id=$2 AND p.data_environment='production' LIMIT 1`,[evidenceId,req.member.id]);
 if(!r.rows.length)return res.status(404).json({ok:false,error:'Evidence not found in an owned production profile.'});
 const u=await db.query(`UPDATE economic_evidence_vault SET verification_status=$1,trust_score=$2,verification_notes=$3,verified_by=$4,verified_at=now() WHERE id=$5 RETURNING id,verification_status AS "verificationStatus",trust_score AS "trustScore",verification_notes AS "verificationNotes",verified_at AS "verifiedAt"`,[decision,score,notes,req.member.id,evidenceId]);
 const v=u.rows[0];
 res.json({ok:true,evidence:v,next:decision==='verified'?'intelligence':'review',meaning:decision==='verified'?'Evidence can contribute to trusted intelligence.':'Evidence is retained but excluded from trusted intelligence.'});
}