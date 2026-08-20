import { db } from 'hatchable';
export const access='member';
export const methods=['POST'];
const clean=(v,max)=>typeof v==='string'?v.trim().slice(0,max):'';
export default async function(req,res){
 const evidenceId=clean(req.body?.evidenceId,80);
 if(!evidenceId)return res.status(400).json({ok:false,error:'evidenceId is required.'});
 const q=await db.query(`SELECT e.id,e.profile_id,e.title,e.evidence_category,e.trust_score,e.verification_status,p.owner_id,p.data_environment FROM economic_evidence_vault e JOIN economic_onboarding_profiles p ON p.id=e.profile_id WHERE e.id=$1 AND p.owner_id=$2 AND p.data_environment='production' LIMIT 1`,[evidenceId,req.member.id]);
 if(!q.rows.length)return res.status(404).json({ok:false,error:'Evidence not found in an owned production profile.'});
 const e=q.rows[0];
 if(e.verification_status!=='verified')return res.status(409).json({ok:false,error:'Only verified evidence can create trusted intelligence.'});
 const strength=Math.max(0,Math.min(100,Number(e.trust_score||0)));
 const confidence=Math.round(strength);
 const signalType=clean(e.evidence_category,60)||'general';
 const existing=await db.query(`SELECT id FROM economic_trusted_evidence_signals WHERE evidence_id=$1 LIMIT 1`,[evidenceId]);
 if(existing.rows.length)return res.status(409).json({ok:false,error:'Trusted intelligence signal already exists for this evidence.',signalId:existing.rows[0].id});
 const r=await db.query(`INSERT INTO economic_trusted_evidence_signals(evidence_id,profile_id,signal_type,signal_strength,confidence,created_by) VALUES($1,$2,$3,$4,$5,$6) RETURNING id,evidence_id AS "evidenceId",profile_id AS "profileId",signal_type AS "signalType",signal_strength AS "signalStrength",confidence,source_verification AS "sourceVerification",created_at AS "createdAt"`,[evidenceId,e.profile_id,signalType,strength,confidence,req.member.id]);
 res.status(201).json({ok:true,signal:r.rows[0],source:{title:e.title,category:e.evidence_category,verificationStatus:e.verification_status},publicExposure:false,next:'network_assessment'});
}