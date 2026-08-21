import { db } from 'hatchable';
export const access='member';
export const methods=['GET'];
export default async function(req,res){
 const owner=req.member.id;
 const profile=await db.query(`SELECT id,display_name,data_environment,onboarding_status FROM economic_onboarding_profiles WHERE owner_id=$1 AND lower(display_name)=lower($2) ORDER BY created_at DESC`,[owner,'OSANVAULT AFRICA LTD']);
 const evidence=profile.rows.length?await db.query(`SELECT id,profile_id,title,verification_status FROM economic_evidence_vault WHERE profile_id=$1 ORDER BY created_at DESC`,[profile.rows[0].id]):{rows:[]};
 const consistent=profile.rows.length<=1 && evidence.rows.every(e=>e.profile_id===profile.rows[0]?.id);
 res.json({ok:true,consistent,profile:profile.rows[0]||null,profileCount:profile.rows.length,evidence:evidence.rows,evidenceCount:evidence.rows.length,publicExposure:false,next:consistent?'real_evidence_intake':'runtime_reconciliation'});
}