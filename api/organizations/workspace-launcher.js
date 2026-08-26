import {readState,memberFor} from '../../lib/phase388-control-plane.js';
export const access='member';
export const methods=['GET'];
export default async function(req,res){
 const s=await readState(),orgId=req.query?.organization_id;
 const orgs=s.organizations.filter(o=>s.members.some(m=>m.organization_id===o.id&&m.member_id===req.member.id&&m.status==='ACTIVE'));
 if(orgId){const o=orgs.find(x=>x.id===orgId);if(!o)return res.status(404).json({error:'workspace_not_found'});const positions=s.positions.filter(p=>p.organization_id===orgId&&p.status==='ACTIVE');const m=memberFor(s,orgId,req.member.id);const p=positions.find(x=>x.position_code===m?.position_code)||positions[0]||null;return res.json({phase:'388.14',member_id:req.member.id,organization:o,positions,selectedPosition:p,routing:p?{dashboard_key:p.dashboard_key,dashboard_url:'/organization-workspace.html?organization_id='+encodeURIComponent(orgId)+'&dashboard='+encodeURIComponent(p.dashboard_key)}:null,tenantIsolation:true});}
 return res.json({phase:'388.14',member_id:req.member.id,launches:orgs.map(o=>{const m=memberFor(s,o.id,req.member.id);const ps=s.positions.filter(p=>p.organization_id===o.id&&p.status==='ACTIVE');const selected=ps.find(p=>p.position_code===m?.position_code)||ps[0];return {organization:o,positions:ps,routing:selected?[{position:selected.position_name,dashboard:selected.dashboard_key,url:'/organization-workspace.html?organization_id='+encodeURIComponent(o.id)+'&dashboard='+encodeURIComponent(selected.dashboard_key)}]:[]}}),tenantIsolation:true});
}