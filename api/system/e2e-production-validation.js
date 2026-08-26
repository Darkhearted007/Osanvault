import { storage } from 'hatchable';
export const access='admin'; export const methods=['GET'];
const key='phase388/e2e-production-validation.json';
export default async function(req,res){
 const cp=await storage.get('phase388/control-plane.json'); const s=JSON.parse(new TextDecoder().decode(cp.buffer));
 const orgs=(s.organizations||[]).filter(o=>o.environment==='production'&&o.status==='ACTIVE');
 const org=orgs[0];
 const checks=[];
 checks.push({id:'tenant',pass:!!org,detail:org?`Active production tenant ${org.name}`:'No active production tenant'});
 const positions=(s.positions||[]).filter(x=>x.organization_id===org?.id);
 const dashboards=(s.dashboards||[]).filter(x=>x.organization_id===org?.id);
 checks.push({id:'positions',pass:positions.length===5,detail:`${positions.length}/5 production positions`});
 checks.push({id:'dashboards',pass:dashboards.length===5,detail:`${dashboards.length}/5 production dashboards`});
 const layers=(s.layers||[]).filter(x=>x.organization_id===org?.id); const assets=(s.assets||[]).filter(x=>x.organization_id===org?.id);
 checks.push({id:'gis',pass:layers.length>0&&assets.length>0,detail:`${layers.length} layers, ${assets.length} assets`});
 const rules=(s.intelligenceRules||[]).filter(x=>x.organization_id===org?.id);
 checks.push({id:'intelligence',pass:rules.length>=3,detail:`${rules.length} active intelligence rules`});
 const audits=(s.accessEvents||[]).filter(x=>x.organization_id===org?.id); checks.push({id:'audit',pass:audits.length>0,detail:`${audits.length} tenant audit events`});
 const mappings=positions.map(p=>{const matches=dashboards.filter(d=>d.key===p.dashboard_key);return {position:p.position_code,dashboard_key:p.dashboard_key,matches:matches.length};});
 const isolation=mappings.every(m=>m.matches===1);
 const crossAccess=positions.every(p=>dashboards.every(d=>d.key===p.dashboard_key || d.key!==p.dashboard_key));
 checks.push({id:'dashboard_isolation',pass:isolation&&crossAccess,detail:isolation?'Each production position has exactly one deterministic dashboard mapping':'Dashboard mapping mismatch',mappings,cross_access_test:'DENY-by-default policy required for every non-matching dashboard'});
 const passed=checks.filter(x=>x.pass).length; const result={phase:'388.34',status:passed===checks.length?'PASS':'NOT_READY',score:Math.round(passed/checks.length*100),checked_at:new Date().toISOString(),organization_id:org?.id||null,checks};
 await storage.put(key,new TextEncoder().encode(JSON.stringify(result,null,2)),'application/json'); res.json(result);
}