import { db } from 'hatchable';
export const access='admin';
export const methods=['GET','POST'];
function hashToken(t){let h=2166136261;for(let i=0;i<t.length;i++){h^=t.charCodeAt(i);h=Math.imul(h,16777619)}return (h>>>0).toString(16)}
export default async function(req,res){
 if(req.method==='GET'){
  const orgs=(await db.query("SELECT id,name,slug,status FROM gis_organizations ORDER BY name")).rows;
  const invitations=(await db.query("SELECT id,organization_id,invitee_member_id,role,position_code,status,expires_at,created_at,accepted_at,revoked_at FROM gis_organization_invitations ORDER BY created_at DESC")).rows;
  const events=(await db.query("SELECT organization_id,member_id,actor_member_id,event_type,metadata,created_at FROM gis_organization_access_events ORDER BY created_at DESC LIMIT 100")).rows;
  return res.json({phase:'388.16',organizations:orgs,invitations,accessEvents:events});
 }
 const b=req.body||{}, action=b.action;
 if(action==='CREATE_INVITATION'){
  if(!b.organization_id||!b.invitee_member_id)return res.status(400).json({error:'organization_id and invitee_member_id are required'});
  const token=b.token||crypto.randomUUID();
  const expires=b.expires_at||new Date(Date.now()+7*86400000).toISOString();
  const r=await db.query("INSERT INTO gis_organization_invitations(organization_id,invitee_member_id,role,position_code,token_hash,expires_at,invited_by,status) VALUES($1,$2,$3,$4,$5,$6,$7,'PENDING') RETURNING id,organization_id,invitee_member_id,role,position_code,status,expires_at",[b.organization_id,b.invitee_member_id,b.role||'USER',b.position_code||null,hashToken(token),expires,req.member.id]);
  await db.query("INSERT INTO gis_organization_access_events(organization_id,member_id,actor_member_id,event_type,metadata) VALUES($1,$2,$3,'INVITATION_CREATED',$4)",[b.organization_id,b.invitee_member_id,req.member.id,JSON.stringify({role:b.role||'USER',position_code:b.position_code||null,phase:'388.16'})]);
  return res.json({phase:'388.16',action,invitation:r.rows[0],token,warning:'Store the invitation token securely; it is returned only at creation.',idempotent:false});
 }
 if(action==='REVOKE_INVITATION'){
  if(!b.invitation_id)return res.status(400).json({error:'invitation_id is required'});
  const r=await db.query("UPDATE gis_organization_invitations SET status='REVOKED',revoked_at=now() WHERE id=$1 AND status='PENDING' RETURNING id,organization_id,invitee_member_id,status,revoked_at",[b.invitation_id]);
  if(!r.rows[0])return res.status(404).json({error:'pending_invitation_not_found'});
  await db.query("INSERT INTO gis_organization_access_events(organization_id,member_id,actor_member_id,event_type,metadata) VALUES($1,$2,$3,'INVITATION_REVOKED',$4)",[r.rows[0].organization_id,r.rows[0].invitee_member_id,req.member.id,JSON.stringify({invitation_id:b.invitation_id,phase:'388.16'})]);
  return res.json({phase:'388.16',action,invitation:r.rows[0]});
 }
 if(action==='DEACTIVATE_MEMBER'||action==='REACTIVATE_MEMBER'){
  if(!b.organization_id||!b.member_id)return res.status(400).json({error:'organization_id and member_id are required'});
  const status=action==='DEACTIVATE_MEMBER'?'INACTIVE':'ACTIVE';
  const r=await db.query("UPDATE gis_organization_members SET status=$3 WHERE organization_id=$1 AND member_id=$2 RETURNING id,organization_id,member_id,role,status",[b.organization_id,b.member_id,status]);
  if(!r.rows[0])return res.status(404).json({error:'member_not_found'});
  await db.query("INSERT INTO gis_organization_access_events(organization_id,member_id,actor_member_id,event_type,metadata) VALUES($1,$2,$3,$4,$5)",[b.organization_id,b.member_id,req.member.id,action,JSON.stringify({phase:'388.16'})]);
  return res.json({phase:'388.16',action,member:r.rows[0]});
 }
 if(action==='CHANGE_ROLE'){
  if(!b.organization_id||!b.member_id||!b.role)return res.status(400).json({error:'organization_id, member_id and role are required'});
  const r=await db.query("UPDATE gis_organization_members SET role=$3 WHERE organization_id=$1 AND member_id=$2 RETURNING id,organization_id,member_id,role,status",[b.organization_id,b.member_id,b.role]);
  if(!r.rows[0])return res.status(404).json({error:'member_not_found'});
  await db.query("INSERT INTO gis_organization_access_events(organization_id,member_id,actor_member_id,event_type,metadata) VALUES($1,$2,$3,'ROLE_CHANGED',$4)",[b.organization_id,b.member_id,req.member.id,JSON.stringify({role:b.role,phase:'388.16'})]);
  return res.json({phase:'388.16',action,member:r.rows[0]});
 }
 if(action==='CHANGE_POSITION'){
  if(!b.organization_id||!b.member_id||!b.position_code)return res.status(400).json({error:'organization_id, member_id and position_code are required'});
  const p=(await db.query("SELECT position_code,position_name,dashboard_key FROM gis_organization_positions WHERE organization_id=$1 AND position_code=$2 AND status='ACTIVE'",[b.organization_id,b.position_code])).rows[0];
  if(!p)return res.status(404).json({error:'position_not_found'});
  await db.query("INSERT INTO gis_organization_access_events(organization_id,member_id,actor_member_id,event_type,metadata) VALUES($1,$2,$3,'POSITION_CHANGED',$4)",[b.organization_id,b.member_id,req.member.id,JSON.stringify(p)]);
  return res.json({phase:'388.16',action,member_id:b.member_id,position:p});
 }
 return res.status(400).json({error:'unsupported_action'});
}