import { db } from 'hatchable';
export const access='member';
export const methods=['GET'];
export default async function(req,res){
 const member=req.member;
 const orgs=(await db.query("SELECT o.id,o.name,o.organization_type FROM gis_organizations o JOIN gis_organization_memberships m ON m.organization_id=o.id WHERE m.member_id=$1 ORDER BY o.name",[member.id])).rows;
 const workspaces=[];
 for(const o of orgs){
  const p=(await db.query("SELECT p.id,p.title,p.dashboard_key FROM gis_organization_positions p WHERE p.organization_id=$1 ORDER BY p.title",[o.id])).rows;
  workspaces.push({organization:o,positions:p.map(x=>({id:x.id,title:x.title,dashboard_key:x.dashboard_key,workspace_url:'/api/continental/gis-phase388-workspace?organization_id='+encodeURIComponent(o.id)+'&dashboard='+encodeURIComponent(x.dashboard_key)}))});
 }
 res.json({phase:388,member_id:member.id,organizations:workspaces});
}