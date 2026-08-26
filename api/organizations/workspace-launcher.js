import { db } from 'hatchable';
export const access='member';
export const methods=['GET'];
export default async function(req,res){
 const member=req.member;
 const orgId=req.query?.organization_id;
 if(orgId){
  const org=(await db.query("SELECT o.id,o.name,o.slug,o.organization_type,o.status,m.role FROM gis_organizations o JOIN gis_organization_members m ON m.organization_id=o.id WHERE o.id=$1 AND m.member_id=$2 AND m.status='ACTIVE'",[orgId,member.id])).rows[0];
  if(!org)return res.status(404).json({error:'workspace_not_found'});
  const positions=(await db.query("SELECT p.id,p.position_code,p.position_name,p.dashboard_key,p.status FROM gis_organization_positions p WHERE p.organization_id=$1 AND EXISTS (SELECT 1 FROM gis_organization_members m WHERE m.organization_id=p.organization_id AND m.member_id=$2 AND m.status='ACTIVE') ORDER BY p.position_name",[orgId,member.id])).rows;
  const selected=positions[0]||null;
  return res.json({phase:'388.14',member_id:member.id,organization:org,positions,selectedPosition:selected,routing:selected?{dashboard_key:selected.dashboard_key,dashboard_url:'/organization-workspace.html?organization_id='+encodeURIComponent(orgId)+'&dashboard='+encodeURIComponent(selected.dashboard_key)}:null,tenantIsolation:true});
 }
 const organizations=(await db.query("SELECT o.id,o.name,o.slug,o.organization_type,o.status,m.role FROM gis_organizations o JOIN gis_organization_members m ON m.organization_id=o.id WHERE m.member_id=$1 AND m.status='ACTIVE' ORDER BY o.name",[member.id])).rows;
 const launches=[];
 for(const o of organizations){
  const p=(await db.query("SELECT id,position_code,position_name,dashboard_key,status FROM gis_organization_positions WHERE organization_id=$1 ORDER BY position_name",[o.id])).rows;
  launches.push({organization:o,positions:p,routing:p.map(x=>({position:x.position_name,dashboard:x.dashboard_key,url:'/organization-workspace.html?organization_id='+encodeURIComponent(o.id)+'&dashboard='+encodeURIComponent(x.dashboard_key)}))});
 }
 res.json({phase:'388.14',member_id:member.id,launches,tenantIsolation:true});
}