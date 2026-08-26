import { readState, writeState, sha256, audit, id, memberFor } from '../../lib/phase388-control-plane.js';
export const access='member';
export const methods=['POST'];
export default async function(req,res){
 const b=req.body||{}; if(!b.token)return res.status(400).json({error:'token is required'});
 const s=await readState(); const hash=await sha256(b.token); const inv=s.invitations.find(x=>x.token_hash===hash);
 if(!inv)return res.status(404).json({error:'invitation_not_found'});
 if(inv.status!=='PENDING')return res.status(409).json({error:'invitation_not_pending',status:inv.status});
 if(new Date(inv.expires_at).getTime()<=Date.now()){inv.status='EXPIRED';audit(s,inv.organization_id,inv.invitee_member_id,req.member.id,'INVITATION_EXPIRED',{invitation_id:inv.id});await writeState(s);return res.status(410).json({error:'invitation_expired'});}
 if(inv.invitee_member_id!==req.member.id)return res.status(403).json({error:'invitation_identity_mismatch'});
 let m=memberFor(s,inv.organization_id,req.member.id);
 if(m){m.status='ACTIVE';m.role=inv.role||m.role;m.position_code=inv.position_code||m.position_code}else{s.members.push({id:id(),organization_id:inv.organization_id,member_id:req.member.id,role:inv.role||'USER',position_code:inv.position_code||null,status:'ACTIVE',created_at:new Date().toISOString()});m=memberFor(s,inv.organization_id,req.member.id)}
 inv.status='ACCEPTED';inv.accepted_at=new Date().toISOString();audit(s,inv.organization_id,req.member.id,req.member.id,'INVITATION_ACCEPTED',{invitation_id:inv.id,position_code:inv.position_code||null});await writeState(s);
 res.json({phase:'388.17',accepted:true,organization_id:inv.organization_id,member:m});
}