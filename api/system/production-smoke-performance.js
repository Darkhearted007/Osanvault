import { storage } from 'hatchable';
export const access='admin'; export const methods=['GET'];
const now=()=>Date.now();
export default async function(req,res){
 const checks=[]; const timings={};
 const t0=now(); let cp=null;
 try{const x=await storage.get('phase388/control-plane.json');cp=JSON.parse(new TextDecoder().decode(x.buffer));timings.control_plane_ms=Number((now()-t0).toFixed(2));}catch(e){timings.control_plane_ms=Number((now()-t0).toFixed(2));}
 const org=(cp?.organizations||[]).find(x=>x.environment==='production'&&x.status==='ACTIVE');
 const positions=(cp?.positions||[]).filter(x=>x.organization_id===org?.id), dashboards=(cp?.dashboards||[]).filter(x=>x.organization_id===org?.id), layers=(cp?.layers||[]).filter(x=>x.organization_id===org?.id), assets=(cp?.assets||[]).filter(x=>x.organization_id===org?.id);
 checks.push({id:'tenant',pass:!!org,detail:'Active production tenant'});
 checks.push({id:'positions',pass:positions.length===5,detail:`${positions.length}/5 positions`});
 checks.push({id:'dashboards',pass:dashboards.length===5&&positions.every(p=>dashboards.filter(d=>d.dashboard_key===p.dashboard_key).length===1),detail:'Dashboard isolation baseline'});
 checks.push({id:'gis',pass:layers.length>0,detail:`${layers.length} GIS layer(s)`});
 checks.push({id:'asset',pass:assets.length>0,detail:`${assets.length} production asset(s)`});
 checks.push({id:'audit',pass:(cp?.accessEvents||[]).some(x=>x.organization_id===org?.id),detail:'Audit trail present'});
 checks.push({id:'response_time',pass:timings.control_plane_ms<1000,detail:`Control-plane read ${timings.control_plane_ms} ms`});
 const passed=checks.filter(x=>x.pass).length;const result={phase:'389.05',status:passed===checks.length?'PASS':'BLOCKED',score:Math.round(passed/checks.length*100),tested_at:new Date().toISOString(),timings_ms:timings,checks,performance_note:'This is an application-level smoke baseline, not a synthetic load test or SLA guarantee.'};
 await storage.put('phase389/smoke-performance/result.json',new TextEncoder().encode(JSON.stringify(result,null,2)),'application/json');res.json(result);
}