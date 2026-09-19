import { db } from 'hatchable';
import { randomHex, sha256Hex } from 'lib/cac-director-security.js';
export const access = 'admin';
export const methods = ['POST'];
export default async function(req,res){
  const body=req.body||{};
  const fullName=String(body.fullName||'').trim();
  const email=String(body.email||'').trim().toLowerCase();
  if(fullName.length<2 || fullName.length>200) return res.status(400).json({error:'Full name must be between 2 and 200 characters'});
  if(email.length>320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({error:'Valid email is required'});
  const existing=await db.query('SELECT id FROM cac_director_profiles WHERE lower(email)=lower($1) AND status <> $2 LIMIT 1',[email,'withdrawn']);
  if(existing.rows.length) return res.status(409).json({error:'A director profile already exists for this email',directorId:existing.rows[0].id});
  const profile=await db.query(`INSERT INTO cac_director_profiles (full_name,email,role_title) VALUES ($1,$2,'Director') RETURNING id, full_name AS "fullName", email, role_title AS "roleTitle", status, consent_status AS "consentStatus"`,[fullName,email]);
  const token=randomHex(32); const tokenHash=await sha256Hex(token);
  const invite=await db.query(`INSERT INTO cac_director_invites (director_id,token_hash,expires_at,created_by) VALUES ($1,$2,now()+interval '14 days',$3) RETURNING id,expires_at AS "expiresAt"`,[profile.rows[0].id,tokenHash,req.member.id]);
  await db.query(`INSERT INTO cac_director_audit_events (director_id,invite_id,event_type,actor,metadata) VALUES ($1,$2,'invite_created',$3,$4)`,[profile.rows[0].id,invite.rows[0].id,req.member.id,JSON.stringify({email})]);
  res.json({ok:true,director:profile.rows[0],inviteId:invite.rows[0].id,expiresAt:invite.rows[0].expiresAt,inviteToken:token,sendReady:false,sendNote:'Email sending remains disabled until osanvaultafrica.com is verified in Hatchable Email Domains.'});
}