import {readState,writeState,id,audit,orgFor} from '../../lib/phase388-control-plane.js';
export const access='admin';
export const methods=['GET','POST'];
export default async function(req,res){
 const s=await readState();
 if(req.method==='GET')return res.json({phase:'388.15',organizations:s.organizations,members:s.members,positions:s.positions,dashboards:s.dashboards});
 const b=req.body||{},action=b.action;
 if(action==='CREATE_ORGANIZATION'){
  if(!b.name||!b.slug)return res.status(400).json({error:'name and slug are required'});
  let o=s.organizations.find(x=>x.slug===b.slug);if(o)o.name=b.name;else{o={id:id(),name:b.name,slug:b.slug,organization_type:b.organization_type||'ENTERPRISE',status:'ACTIVE',created_at:new Date().toISOString()};s.organizations.push(o)}
  audit(s,o.id,null,req.member.id,'ORGANIZATION_PROVISIONED',{phase:'388.15'});await writeState(s);return res.json({phase:'388.15',action,organization:o,idempotent:!!s.organizations.find(x=>x.slug===b.slug&&x.id!==o.id)});
 }
 if(action==='INVITE_MEMBER'){
  if(!orgFor(s,b.organization_id)||!b.member_id)return res.status(400).json({error:'organization_id and member_id are required'});
  let m=s.members.find(x=>x.organization_id===b.organization_id&&x.member_id===b.member_id);if(!m){m={id:id(),organization_id:b.organization_id,member_id:b.member_id,role:b.role||'USER',status:'ACTIVE',position_code:null,dashboard_key:null,created_at:new Date().toISOString()};s.members.push(m)}else{m.role=b.role||m.role;m.status='ACTIVE'}
  audit(s,b.organization_id,b.member_id,req.member.id,'MEMBER_PROVISIONED',{role:m.role,phase:'388.15'});await writeState(s);return res.json({phase:'388.15',action,member:m,idempotent:true});
 }
 if(action==='ASSIGN_POSITION'){
  if(!orgFor(s,b.organization_id)||!b.position_code||!b.position_name||!b.dashboard_key)return res.status(400).json({error:'organization_id, position_code, position_name and dashboard_key are required'});
  let p=s.positions.find(x=>x.organization_id===b.organization_id&&x.position_code===b.position_code);if(!p){p={id:id(),organization_id:b.organization_id,position_code:b.position_code,position_name:b.position_name,dashboard_key:b.dashboard_key,status:'ACTIVE'};s.positions.push(p)}else{p.position_name=b.position_name;p.dashboard_key=b.dashboard_key;p.status='ACTIVE'}
  if(!s.dashboards.find(x=>x.organization_id===b.organization_id&&x.dashboard_key===b.dashboard_key&&x.position_code===b.position_code))s.dashboards.push({id:id(),organization_id:b.organization_id,dashboard_key:b.dashboard_key,position_code:b.position_code,config:{}});
  audit(s,b.organization_id,null,req.member.id,'POSITION_PROVISIONED',{position_code:p.position_code,dashboard_key:p.dashboard_key,phase:'388.15'});await writeState(s);return res.json({phase:'388.15',action,position:p,dashboard_key:p.dashboard_key,idempotent:true});
 }
 return res.status(400).json({error:'unsupported_action'});
}