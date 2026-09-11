import { db } from 'hatchable';
import { readState, writeState, id, audit, orgFor } from '../../lib/phase388-control-plane.js';
export const access='admin';
export const methods=['GET','POST'];

function callerId(req){ return String(req?.member?.id || req?.user?.id || '').trim(); }
async function canonicalAdmin(req, organizationId){
 const uid=callerId(req), oid=String(organizationId||'').trim();
 if(!uid||!oid)return {allowed:false,reason:'missing_identity_or_organization'};
 const r=await db.query(`SELECT m.id,m.member_id,m.role,m.status,o.id organization_id,o.status organization_status FROM gis_organization_members m JOIN gis_organizations o ON o.id=m.organization_id WHERE m.member_id=$1 AND m.organization_id=$2 AND m.status='ACTIVE' AND o.status='ACTIVE' LIMIT 1`,[uid,oid]);
 if(!r.rows[0])return {allowed:false,reason:'organization_access_denied'};
 if(!['OWNER','ADMIN'].includes(String(r.rows[0].role).toUpperCase()))return {allowed:false,reason:'permission_denied'};
 return {allowed:true,row:r.rows[0]};
}
export default async function(req,res){
 const s=await readState();
 if(req.method==='GET')return res.json({phase:'388.15',organizations:s.organizations,members:s.members,positions:s.positions,dashboards:s.dashboards});
 const b=req.body||{},action=b.action;
 if(action==='RECONCILE_FOUNDER'){
  const email=String(b.email||'').trim().toLowerCase();
  if(!email)return res.status(400).json({error:'email is required'});
  const user=await db.query(`SELECT id,email,email_verified_at FROM users WHERE lower(email)=$1`,[email]);
  if(!user.rows[0])return res.status(404).json({error:'founder user not found'});
  if(!user.rows[0].email_verified_at)return res.status(403).json({error:'founder email is not verified'});
  const org=await db.query(`SELECT id,name,slug FROM gis_organizations WHERE slug='osanvault-africa-production' AND status='ACTIVE'`);
  if(!org.rows[0])return res.status(404).json({error:'production organization not found'});
  const existing=await db.query(`SELECT id,role,status FROM gis_organization_members WHERE organization_id=$1 AND member_id=$2`,[org.rows[0].id,user.rows[0].id]);
  if(!existing.rows[0])return res.status(409).json({error:'founder membership does not exist; onboarding must use the canonical membership workflow'});
  if(existing.rows[0].status!=='ACTIVE')return res.status(403).json({error:'founder membership is not active'});
  if(!['OWNER','ADMIN'].includes(String(existing.rows[0].role).toUpperCase()))return res.status(403).json({error:'founder membership lacks canonical administrative authority'});
  return res.json({phase:'production-founder-reconciliation',status:'VERIFIED',organization:org.rows[0],user:{id:user.rows[0].id,email},member:existing.rows[0]});
 }
 if(action==='INVITE_MEMBER'){
  const auth=await canonicalAdmin(req,b.organization_id); if(!auth.allowed)return res.status(403).json({error:auth.reason});
  if(!b.member_id)return res.status(400).json({error:'member_id is required'});
  let m=s.members.find(x=>x.organization_id===b.organization_id&&x.member_id===b.member_id);
  if(!m){m={id:id(),organization_id:b.organization_id,member_id:b.member_id,role:b.role||'USER',status:'ACTIVE',position_code:null,dashboard_key:null,created_at:new Date().toISOString()};s.members.push(m)} else {m.role=b.role||m.role;m.status='ACTIVE'}
  audit(s,b.organization_id,b.member_id,callerId(req),'MEMBER_PROVISIONED',{role:m.role,phase:'388.15'});await writeState(s);return res.json({phase:'388.15',action,member:m,idempotent:true});
 }
 if(action==='ASSIGN_POSITION'){
  const auth=await canonicalAdmin(req,b.organization_id); if(!auth.allowed)return res.status(403).json({error:auth.reason});
  if(!b.position_code||!b.position_name||!b.dashboard_key)return res.status(400).json({error:'position_code, position_name and dashboard_key are required'});
  let p=s.positions.find(x=>x.organization_id===b.organization_id&&x.position_code===b.position_code);
  if(!p){p={id:id(),organization_id:b.organization_id,position_code:b.position_code,position_name:b.position_name,dashboard_key:b.dashboard_key,status:'ACTIVE'};s.positions.push(p)}else{p.position_name=b.position_name;p.dashboard_key=b.dashboard_key;p.status='ACTIVE'}
  if(!s.dashboards.find(x=>x.organization_id===b.organization_id&&x.dashboard_key===b.dashboard_key&&x.position_code===b.position_code))s.dashboards.push({id:id(),organization_id:b.organization_id,dashboard_key:b.dashboard_key,position_code:b.position_code,config:{}});
  audit(s,b.organization_id,null,callerId(req),'POSITION_PROVISIONED',{position_code:p.position_code,dashboard_key:p.dashboard_key,phase:'388.15'});await writeState(s);return res.json({phase:'388.15',action,position:p,dashboard_key:p.dashboard_key,idempotent:true});
 }
 if(action==='CREATE_ORGANIZATION')return res.status(403).json({error:'organization_creation_requires_canonical_provisioning_workflow'});
 return res.status(400).json({error:'unsupported_action'});
}