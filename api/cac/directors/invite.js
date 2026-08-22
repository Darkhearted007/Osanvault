import { db } from 'hatchable';
import { sha256Hex } from 'lib/cac-director-security.js';
export const access = 'public';
export const methods = ['GET'];
export default async function(req,res){
  const token=String(req.query?.token||'');
  if(!token) return res.status(400).json({error:'Invite token is required'});
  const {rows}=await db.query(`SELECT i.id AS "inviteId", i.status, i.expires_at AS "expiresAt", d.id AS "directorId", d.full_name AS "fullName", d.email, d.role_title AS "roleTitle", d.consent_status AS "consentStatus", d.date_of_birth AS "dateOfBirth", d.nationality, d.occupation, d.residential_address AS "residentialAddress", d.service_address AS "serviceAddress", d.phone, d.id_document_status AS "idDocumentStatus" FROM cac_director_invites i JOIN cac_director_profiles d ON d.id=i.director_id WHERE i.token_hash=$1 LIMIT 1`,[await sha256Hex(token)]);
  if(!rows.length) return res.status(404).json({error:'Invite not found or invalid'});
  const invite=rows[0];
  if(new Date(invite.expiresAt)<=new Date()) return res.status(410).json({error:'This invitation has expired'});
  if(invite.status==='pending') await db.query(`UPDATE cac_director_invites SET status='opened',opened_at=COALESCE(opened_at,now()),updated_at=now() WHERE id=$1`,[invite.inviteId]);
  res.json({ok:true,company:'OSANVAULT AFRICA LTD',invite:{id:invite.inviteId,status:invite.status,expiresAt:invite.expiresAt},director:{id:invite.directorId,fullName:invite.fullName,email:invite.email,roleTitle:invite.roleTitle,consentStatus:invite.consentStatus,dateOfBirth:invite.dateOfBirth,nationality:invite.nationality,occupation:invite.occupation,residentialAddress:invite.residentialAddress,serviceAddress:invite.serviceAddress,phone:invite.phone,idDocumentStatus:invite.idDocumentStatus},scope:['Corporate governance and strategic decision participation','Board discussions and resolutions','Corporate compliance and document review','Responsible company growth and governance']});
}