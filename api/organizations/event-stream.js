import { readState, writeState, audit, memberFor, orgFor, id } from '../../lib/phase388-control-plane.js';
export const access='member';
export const methods=['GET','POST'];
const allowedDashboards={executive:['overview','risk','opportunities','reports'],operations:['assets','alerts','risk','actions','reports'],analyst:['evidence','signals','gis','risk','relationships','reports'],regulator:['compliance','evidence','jurisdiction','risk','review_queue','audit','reports'],investor:['portfolio','readiness','risk','evidence_confidence','opportunities','reports']};
const eventModules={ASSET:['assets'],ASSET_STATUS:['assets'],ALERT:['alerts','risk'],RISK:['risk'],EVIDENCE:['evidence'],SIGNAL:['signals'],GIS:['gis'],OPPORTUNITY:['opportunities'],REPORT:['reports'],ACTION:['actions'],COMPLIANCE:['compliance','evidence'],SYSTEM:['overview']};
const hashId=s=>{let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return (h>>>0).toString(16)};
function scoped(s,orgId,after){return (s.events||[]).filter(e=>e.organization_id===orgId&&e.seq>after).sort((a,b)=>a.seq-b.seq).slice(0,100)}
export default async function(req,res){
 const b=req.body||{}; const orgId=req.query?.organization_id||b.organization_id; const dashboard=String(req.query?.dashboard||b.dashboard||'').toLowerCase();
 if(!orgId||!dashboard)return res.status(400).json({error:'organization_id and dashboard are required'});
 const s=await readState(),org=orgFor(s,orgId),member=memberFor(s,orgId,req.member.id);
 if(!org)return res.status(404).json({error:'organization_not_found'}); if(!member||member.status!=='ACTIVE')return res.status(403).json({error:'organization_access_denied'});
 const pos=s.positions.find(p=>p.organization_id===orgId&&p.position_code===member.position_code&&p.status==='ACTIVE');
 if(!pos||String(pos.dashboard_key).toLowerCase()!==dashboard)return res.status(403).json({error:'dashboard_not_authorized'});
 const allowed=allowedDashboards[dashboard]||[]; const requested=String(req.query?.module||b.module||'').toLowerCase(); if(requested&&!allowed.includes(requested))return res.status(403).json({error:'module_not_authorized'});
 if(req.method==='POST'){
  const type=String(b.type||'SYSTEM').toUpperCase(); const modules=eventModules[type]||[String(b.module||'overview').toLowerCase()]; const event={id:id(),organization_id:orgId,type,module:requested||modules[0],severity:String(b.severity||'INFO').toUpperCase(),title:String(b.title||type),message:String(b.message||''),payload:b.payload||{},created_at:new Date().toISOString(),seq:(s.eventSeq||0)+1,acknowledged_by:[]};
  if(requested&&!modules.includes(requested))return res.status(403).json({error:'event_module_not_authorized'});
  s.eventSeq=event.seq;s.events=s.events||[];s.events.push(event);if(s.events.length>2000)s.events=s.events.slice(-2000);audit(s,orgId,req.member.id,req.member.id,'EVENT_PUBLISHED',{event_id:event.id,type:event.type,module:event.module,seq:event.seq});await writeState(s);return res.json({phase:'388.21',published:true,event});
 }
 const after=Math.max(0,Number(req.query?.after||0)||0);const events=scoped(s,orgId,after).filter(e=>!requested||e.module===requested);const unread=events.filter(e=>!(e.acknowledged_by||[]).includes(req.member.id)).length;
 res.json({phase:'388.21',organization:{id:org.id,name:org.name},dashboard,position:pos.position_code,module:requested||null,cursor:events.length?events[events.length-1].seq:after,events,unread,stream:'STORAGE_EVENT_STREAM',tenantIsolation:true});
}