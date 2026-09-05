import { readState, memberFor } from 'lib/phase388-control-plane.js';
export const access='member';
export const methods=['GET'];
export default async function(req,res){
 const s=await readState();
 const organizations=(s.members||[])
  .filter(m=>String(m.member_id)===String(req.member.id)&&m.status==='ACTIVE')
  .map(m=>{
   const o=(s.organizations||[]).find(x=>x.id===m.organization_id);
   if(!o||o.status!=='ACTIVE') return null;
   const p=(s.positions||[]).find(x=>x.organization_id===o.id&&x.position_code===m.position_code&&x.status==='ACTIVE');
   return {id:o.id,name:o.name,slug:o.slug||null,organizationType:o.organization_type||'production',status:o.status,dashboardMode:o.dashboard_mode||p?.dashboard_key||null,role:m.role||'ADMIN',positionCode:m.position_code||null,positionTitle:m.position_title||null,dashboardKey:m.dashboard_key||p?.dashboard_key||null};
  }).filter(Boolean);
 return res.json({organizations});
}