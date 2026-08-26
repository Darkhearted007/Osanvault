import { readState, writeState, audit, memberFor, orgFor, id } from '../../lib/phase388-control-plane.js';
export const access='member';
export const methods=['POST'];
const EVENT_MODULES={ASSET:['assets'],ASSET_STATUS:['assets'],ALERT:['alerts','risk'],RISK:['risk'],EVIDENCE:['evidence'],SIGNAL:['signals'],GIS:['gis'],OPPORTUNITY:['opportunities'],REPORT:['reports'],ACTION:['actions'],COMPLIANCE:['compliance','evidence'],SYSTEM:['overview']};
const DASHBOARD_MODULES={executive:['overview','risk','opportunities','reports'],operations:['assets','alerts','risk','actions','reports'],analyst:['evidence','signals','gis','risk','relationships','reports'],regulator:['compliance','evidence','jurisdiction','risk','review_queue','audit','reports'],investor:['portfolio','readiness','risk','evidence_confidence','opportunities','reports']};
export default async function(req,res){
 const b=req.body||{},orgId=b.organization_id;
 if(!orgId||!b.type)return res.status(400).json({error:'organization_id and type are required'});
 const s=await readState(),org=orgFor(s,orgId),m=memberFor(s,orgId,req.member.id);
 if(!org)return res.status(404).json({error:'organization_not_found'}); if(!m||m.status!=='ACTIVE')return res.status(403).json({error:'organization_access_denied'});
 const type=String(b.type).toUpperCase(), modules=EVENT_MODULES[type]||[String(b.module||'overview').toLowerCase()];
 if(!modules.length)return res.status(400).json({error:'event_module_required'});
 const event={id:id(),organization_id:orgId,type,module:String(b.module||modules[0]).toLowerCase(),severity:String(b.severity||'INFO').toUpperCase(),title:String(b.title||type),message:String(b.message||''),payload:b.payload||{},created_at:new Date().toISOString(),seq:(s.eventSeq||0)+1,acknowledged_by:[]};
 if(!modules.includes(event.module))return res.status(400).json({error:'event_module_invalid'});
 s.eventSeq=event.seq;s.events=s.events||[];s.events.push(event);if(s.events.length>2000)s.events=s.events.slice(-2000);
 audit(s,orgId,req.member.id,req.member.id,'INTELLIGENCE_EVENT_GENERATED',{event_id:event.id,type,event_module:event.module,seq:event.seq});await writeState(s);
 res.json({phase:'388.22',generated:true,event,fanout:DASHBOARD_MODULES});
}