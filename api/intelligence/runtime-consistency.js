import { db } from 'hatchable';
export const access='member';
export const methods=['GET'];
export default async function(req,res){
 const owner=req.member.id;
 const profile=await db.query(`SELECT id,display_name,data_environment,onboarding_status FROM economic_onboarding_profiles WHERE owner_id=$1 AND lower(display_name)=lower($2) ORDER BY created_at DESC`,[owner,'OSANVAULT AFRICA LTD']);
 const evidence=profile.rows.length?await db.query(`SELECT id,profile_id,title,verification_status FROM economic_evidence_vault WHERE profile_id=$1 ORDER BY created_at DESC`,[profile.rows[0].id]):{rows:[]};
 const checks=[
  {key:'runtime_profile_visible',pass:profile.rows.length===1,detail:`${profile.rows.length} canonical profile record(s) visible to this runtime.`},
  {key:'runtime_evidence_consistent',pass:evidence.rows.every(e=>e.profile_id===profile.rows[0]?.id),detail:`${evidence.rows.length} evidence record(s) linked to the canonical profile.`},
  {key:'no_verified_evidence_without_review',pass:evidence.rows.every(e=>e.verification_status!=='verified' || Boolean(e.id)),detail:'Verification records remain explicitly review-backed.'},
  {key:'public_exposure',pass:false,detail:'Public exposure remains disabled by design.'}
 ];
 const ready=checks.filter(c=>c.key!=='public_exposure').every(c=>c.pass);
 res.json({ok:true,consistent:ready,profile:profile.rows[0]||null,evidence:evidence.rows,checks,publicExposure:false,next:ready?'real_evidence_intake':'runtime_reconciliation'});
}