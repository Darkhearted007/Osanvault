import { db, email } from 'hatchable';
import { sha256Hex } from 'lib/cac-director-security.js';
export const access = 'admin';
export const methods = ['POST'];
export default async function(req,res){
  const { inviteId, inviteToken }=req.body||{};
  if(!inviteId || !inviteToken) return res.status(400).json({error:'inviteId and inviteToken are required'});
  const { rows }=await db.query(`SELECT i.id, i.expires_at AS "expiresAt", i.status, d.id AS "directorId", d.full_name AS "fullName", d.email FROM cac_director_invites i JOIN cac_director_profiles d ON d.id=i.director_id WHERE i.id=$1 LIMIT 1`,[inviteId]);
  if(!rows.length) return res.status(404).json({error:'Invite not found'});
  const invite=rows[0];
  if(!['pending','opened'].includes(invite.status)) return res.status(409).json({error:'Invite is no longer sendable'});
  if(new Date(invite.expiresAt)<=new Date()) return res.status(410).json({error:'Invite has expired'});
  const supplied=await sha256Hex(inviteToken);
  const check=await db.query('SELECT id FROM cac_director_invites WHERE id=$1 AND token_hash=$2 LIMIT 1',[inviteId,supplied]);
  if(!check.rows.length) return res.status(403).json({error:'Invalid invite token'});
  const link=`${new URL(req.url,'https://osanvault-africa.hatchable.site').origin}/cac-director-invite?token=${encodeURIComponent(inviteToken)}`;
  const html=`<div style="font-family:Arial,sans-serif;max-width:680px;margin:auto;color:#172019"><h2>Proposed Appointment as Director</h2><p>Dear ${invite.fullName},</p><p>OSANVAULT AFRICA LTD invites you to serve as a <strong>Director</strong>, subject to your consent and completion of the company's CAC registration requirements.</p><h3>Proposed scope</h3><ul><li>Participate in corporate governance and strategic decisions.</li><li>Support company compliance and review of important corporate documents.</li><li>Participate in Board discussions and resolutions.</li><li>Support responsible growth of the company's technology and real-world asset intelligence activities.</li><li>Act in the best interests of OSANVAULT AFRICA LTD and comply with applicable obligations.</li></ul><p>This does not by itself constitute a completed CAC appointment. Your consent and required particulars must be recorded before filing.</p><p><a href="${link}" style="display:inline-block;padding:12px 18px;background:#183d25;color:#fff;text-decoration:none;border-radius:8px;font-weight:700">Review &amp; Respond</a></p><p>Kind regards,<br>Corporate Office<br>OSANVAULT AFRICA LTD<br>corporate@osanvaultafrica.com</p></div>`;
  try{ await email.send({to:invite.email,subject:'Proposed Appointment as Director — OSANVAULT AFRICA LTD',html}); }
  catch(err){ return res.status(503).json({error:'Company email sender is not ready yet. Verify osanvaultafrica.com in Hatchable Email Domains first.',detail:String(err?.message||err)}); }
  await db.query(`UPDATE cac_director_invites SET status='sent',sent_at=now(),updated_at=now() WHERE id=$1`,[inviteId]);
  await db.query(`INSERT INTO cac_director_audit_events (director_id,invite_id,event_type,actor,metadata) VALUES ($1,$2,'invite_sent',$3,'{}'::jsonb)`,[invite.directorId,inviteId,req.member.id]);
  res.json({ok:true,sentTo:invite.email});
}