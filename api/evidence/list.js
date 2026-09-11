import { db } from 'hatchable';
export const access='member';
export const methods=['GET'];
export default async function(req,res){
 if(!req.member?.id)return res.status(401).json({ok:false,error:'authentication_required'});
 const r=await db.query(`SELECT e.id,e.profile_id,e.evidence_category,e.title,e.description,e.source_type,e.storage_url,e.verification_status,e.trust_score,e.reviewed_by,e.reviewed_at,e.review_notes,e.created_at FROM economic_evidence_vault e JOIN economic_onboarding_profiles p ON p.id=e.profile_id WHERE e.profile_id=$1 AND p.owner_id=$2 ORDER BY e.created_at DESC`,[req.query?.profileId,req.member.id]);
 res.json({ok:true,evidence:r.rows,publicExposure:false});
}