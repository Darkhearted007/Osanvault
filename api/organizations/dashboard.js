import { readState, memberFor } from 'lib/phase388-control-plane.js';
export const access='user';
export const methods=['GET'];
export default async function(req,res){
 const orgId=req.query?.organizationId;
 if(!orgId)return res.status(400).json({error:'organizationId is required'});
 const requestedPosition=req.query?.positionCode||null;
 const s=await readState();
 const organization=(s.organizations||[]).find(o=>o.id===orgId&&o.status==='ACTIVE');
 if(!organization)return res.status(404).json({error:'Organization not found'});
 const membership=memberFor(s,orgId,req.user.id);
 if(!membership||membership.status!=='ACTIVE')return res.status(403).json({error:'Organization access denied'});
 const positionCode=requestedPosition||membership.position_code||null;
 if(requestedPosition&&requestedPosition!==membership.position_code)return res.status(403).json({error:'Position access denied'});
 const dashboards=(s.dashboards||[]).filter(d=>d.organization_id===orgId&&d.status==='ACTIVE'&&(!positionCode||d.dashboard_key===positionCode.toLowerCase()||d.key===positionCode.toLowerCase()||d.position_code===positionCode));
 const assets=(s.assets||[]).filter(a=>a.organization_id===orgId&&a.status==='ACTIVE').map(a=>({assetId:a.id,accessLevel:'authorized',name:a.name,assetType:a.asset_type,status:a.status}));
 const assetIds=new Set(assets.map(a=>a.assetId));
 const intelligence={
  assets:(s.assetIntelligence||[]).filter(x=>x.organization_id===orgId&&assetIds.has(x.asset_id)),
  risk:(s.risks||[]).filter(x=>x.organization_id===orgId&&assetIds.has(x.asset_id)),
  alerts:(s.signals||[]).filter(x=>x.organization_id===orgId&&assetIds.has(x.asset_id)),
  reports:[]
 };
 res.json({phase:388.1,organization:{id:organization.id,name:organization.name,slug:organization.slug||null,organizationType:organization.organization_type||'production',status:organization.status,role:membership.role||'ADMIN',positionCode:membership.position_code||null,positionTitle:membership.position_title||null,dashboardKey:membership.dashboard_key||null},dashboards,assets,positionCode,intelligence,modules:['overview','assets','risk','alerts','gis','reports','recommendations'],tenantIsolated:true});
}