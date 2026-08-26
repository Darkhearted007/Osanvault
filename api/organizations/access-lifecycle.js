import {readState,writeState,id,sha256,audit,orgFor,memberFor} from '../../lib/phase388-control-plane.js';
export const access='admin';
export const methods=['GET','POST'];
export default async function(req,res){
 const s=await readState();
 if(req.method==='GET')return res.json({phase:'388.16',organizations:s.organizations,invitations:s.invitations,accessEvents:s.accessEvents});
 const b=req.body||{},action=b.action;
 if(action==='CREATE_INVITATION'){
  if(!b.organization_id||!b.invitee_member_id)return res.status(400).json({error:'organization_id and invitee_member_id are required'});
  if(!orgFor(s,b.organization_id))return res.status(404).json({error:'organization_not_found'});
  const token=b.token||crypto.randomUUID(), invitation={id:id(),organization_id:b.organization_id,invitee_member_id:b.invitee_member_id,role:b.role||'USER',position_code:b.position_code||null,status:'PENDING',expires_at:b.expires_at||new Date(Date.now()+7*86400000).toISOString(),invited_by:req.member.id,created_at:new Date().toISOString(),accepted_at:null,revoked_at:null,token_hash:await sha256(token)};
  s.invitations.push(invitation);audit(s,b.organization_id,b.invitee_member_id,req.member.id,'INVITATION_CREATED',{role:invitation.role,position_code:invitation.position_code,phase:'388.16'});await writeState(s);
  const {token_hash,...safe}=invitation;return res.json({phase:'388.16',action,invitation:safe,token,warning:'Store the invitation token securely; it is returned only at creation.'});
 }
 if(action==='REVOKE_INVITATION'){
  const x=s.invitations.find(i=>i.id===b.invitation_id&&i.status==='PENDING');if(!x)return res.status(404).json({error:'pending_invitation_not_found'});x.status='REVOKED';x.revoked_at=new Date().toISOString();audit(s,x.organization_id,x.invitee_member_id,req.member.id,'INVITATION_REVOKED',{invitation_id:x.id,phase:'388.16'});await writeState(s);return res.json({phase:'388.16',action,invitation:x});
 }
 if(action==='DEACTIVATE_MEMBER'||action==='REACTIVATE_MEMBER'){
  const m=memberFor(s,b.organization_id,b.member_id);if(!m)return res.status(404).json({error:'member_not_found'});m.status=action==='DEACTIVATE_MEMBER'?'INACTIVE':'ACTIVE';audit(s,b.organization_id,b.member_id,req.member.id,action,{phase:'388.16'});await writeState(s);return res.json({phase:'388.16',action,member:m});
 }
 if(action==='CHANGE_ROLE'){
  const m=memberFor(s,b.organization_id,b.member_id);if(!m||!b.role)return res.status(404).json({error:'member_not_found_or_role_missing'});m.role=b.role;audit(s,b.organization_id,b.member_id,req.member.id,'ROLE_CHANGED',{role:b.role,phase:'388.16'});await writeState(s);return res.json({phase:'388.16',action,member:m});
 }
 if(action==='CHANGE_POSITION'){
  const m=memberFor(s,b.organization_id,b.member_id),p=s.positions.find(x=>x.organization_id===b.organization_id&&x.position_code===b.position_code&&x.status==='ACTIVE');if(!m||!p)return res.status(404).json({error:'member_or_position_not_found'});m.position_code=p.position_code;m.dashboard_key=p.dashboard_key;audit(s,b.organization_id,b.member_id,req.member.id,'POSITION_CHANGED',{position_code:p.position_code,dashboard_key:p.dashboard_key,phase:'388.16'});await writeState(s);return res.json({phase:'388.16',action,member:m,position:p});
 }
 return res.status(400).json({error:'unsupported_action'});
}