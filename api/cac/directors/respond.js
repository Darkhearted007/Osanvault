import { db } from 'hatchable';
import { sha256Hex } from 'lib/cac-director-security.js';
export const access = 'public';
export const methods = ['POST'];
export default async function(req,res){
  const b=req.body||{}; const token=String(b.token||'');
  if(!token) return res.status(400).json({error:'Invite token is required'});
  const {rows}=await db.query(`SELECT i.id AS "inviteId", i.expires_at AS "expiresAt", d.id AS "directorId", d.full_name AS "fullName", d.email FROM cac_director_invites i JOIN cac_director_profiles d ON d.id=i.director_id WHERE i.token_hash=$1 LIMIT 1`,[await sha256Hex(token)]);
  if(!rows.length) return res.status(404).json({error:'Invite not found'});
  const invite=rows[0];
  if(new Date(invite.expiresAt)<=new Date()) return res.status(410).json({error:'This invitation has expired'});
  if(String(b.decision||'').toLowerCase()!=='accept') return res.status(400).json({error:'This endpoint records acceptance only. Contact the company if you decline.'});
  const consent=`I, ${invite.fullName}, agree to serve as a Director of OSANVAULT AFRICA LTD, subject to completion of the company's CAC registration requirements.`;
  await db.query(`UPDATE cac_director_profiles SET consent_status='accepted',consent_statement=$1,consented_at=now(),status='consent_received',date_of_birth=$2,nationality=$3,occupation=$4,residential_address=$5,service_address=$6,phone=$7,updated_at=now() WHERE id=$8`,[consent,b.dateOfBirth||null,b.nationality||null,b.occupation||null,b.residentialAddress||null,b.serviceAddress||null,b.phone||null,invite.directorId]);
  await db.query(`UPDATE cac_director_invites SET status='responded',responded_at=now(),updated_at=now() WHERE id=$1`,[invite.inviteId]);
  await db.query(`INSERT INTO cac_director_audit_events (director_id,invite_id,event_type,actor,metadata) VALUES ($1,$2,'consent_received',$3,$4)`,[invite.directorId,invite.inviteId,invite.email,JSON.stringify({decision:'accept'})]);
  res.json({ok:true,status:'consent_received',message:'Your consent has been recorded. The company will complete its CAC filing checks before submission.'});
}