import { readState, audit, writeState, memberFor, orgFor } from '../../lib/phase388-control-plane.js';
export const access='member';
export const methods=['GET'];
const modules={executive:['overview','risk','opportunities','reports'],operations:['assets','alerts','risk','actions','reports'],analyst:['evidence','signals','gis','risk','relationships','reports'],regulator:['compliance','evidence','jurisdiction','risk','review_queue','audit','reports'],investor:['portfolio','readiness','risk','evidence_confidence','opportunities','reports']};
export default async function(req,res){
 const orgId=req.query?.organization_id,dashboard=String(req.query?.dashboard||'').toLowerCase();
 if(!orgId||!dashboard)return res.status(400).json({error:'organization_id and dashboard are required'});
 const s=await readState(),org=orgFor(s,orgId),member=memberFor(s,orgId,req.member.id);
 if(!org)return res.status(404).json({error:'organization_not_found'});
 if(!member||member.status!=='ACTIVE')return res.status(403).json({error:'organization_access_denied'});
 const position=s.positions.find(p=>p.organization_id===orgId&&p.position_code===member.position_code&&p.status==='ACTIVE');
 if(!position||String(position.dashboard_key).toLowerCase()!==dashboard)return res.status(403).json({error:'dashboard_not_authorized'});
 const allowed=modules[dashboard]||[]; const requested=String(req.query?.module||'').toLowerCase();
 if(requested&&!allowed.includes(requested))return res.status(403).json({error:'module_not_authorized'});
 const scoped=(arr,field)=>arr.filter(x=>x.organization_id===orgId);
 const data={assets:scoped(s.assets),layers:scoped(s.layers),alerts:scoped(s.alerts||[]),evidence:scoped(s.evidence||[]),signals:scoped(s.signals||[]),risks:scoped(s.risks||[]),opportunities:scoped(s.opportunities||[]),reports:scoped(s.reports||[])};
 audit(s,orgId,req.member.id,req.member.id,'DASHBOARD_DATA_ACCESSED',{dashboard,module:requested||'all',available_modules:allowed}); await writeState(s);
 res.json({phase:'388.20',organization:{id:org.id,name:org.name,type:org.organization_type},member:{id:member.member_id,role:member.role,position_code:member.position_code},dashboard,modules:allowed,selected_module:requested||null,data,counts:Object.fromEntries(Object.entries(data).map(([k,v])=>[k,v.length])),dataBinding:'LIVE_CONTROL_PLANE',tenantIsolation:true});
}