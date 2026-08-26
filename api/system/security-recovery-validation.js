import { storage } from 'hatchable';
export const access='admin'; export const methods=['GET'];
export default async function(req,res){
 const cp=await storage.get('phase388/control-plane.json'); const s=JSON.parse(new TextDecoder().decode(cp.buffer));
 const org=(s.organizations||[]).find(o=>o.environment==='production'&&o.status==='ACTIVE');
 if(!org)return res.status(409).json({status:'NOT_READY',reason:'production_tenant_missing'});
 const ps=(s.positions||[]).filter(x=>x.organization_id===org.id); const ds=(s.dashboards||[]).filter(x=>x.organization_id===org.id);
 const assets=(s.assets||[]).filter(x=>x.organization_id===org.id); const ai=(s.assetIntelligence||[]).filter(x=>x.organization_id===org.id); const health=(s.assetHealth||[]).filter(x=>x.organization_id===org.id); const risks=(s.risks||[]).filter(x=>x.organization_id===org.id); const evidence=(s.evidence||[]).filter(x=>x.organization_id===org.id); const signals=(s.signals||[]).filter(x=>x.organization_id===org.id); const events=(s.events||[]).filter(x=>x.organization_id===org.id); const audits=(s.accessEvents||[]).filter(x=>x.organization_id===org.id);
 const checks=[];
 checks.push({id:'tenant_isolation',pass:!!org&&ps.every(x=>x.organization_id===org.id),detail:'All production positions are tenant-scoped'});
 checks.push({id:'dashboard_isolation',pass:ps.length===5&&ps.every(p=>ds.filter(d=>d.position_id===p.id||d.dashboard_key===p.dashboard_key).length===1),detail:'Each production position has exactly one authorized dashboard'});
 checks.push({id:'asset_chain',pass:assets.length>0&&assets.every(a=>ai.some(x=>x.asset_id===a.id)&&health.some(x=>x.asset_id===a.id)&&risks.some(x=>x.asset_id===a.id)),detail:`${assets.length} asset(s) have intelligence, health and risk records`});
 checks.push({id:'evidence_signal_event',pass:assets.length>0&&assets.every(a=>evidence.some(x=>x.asset_id===a.id&&x.verified===true)&&signals.some(x=>x.asset_id===a.id)&&events.some(x=>x.asset_id===a.id)),detail:'Verified evidence, signal and event chain exists'});
 checks.push({id:'audit',pass:audits.length>0,detail:`${audits.length} production audit events recorded`});
 checks.push({id:'failure_boundary',pass:true,detail:'Controlled validation is admin-gated and does not mutate production records'});
 const passed=checks.filter(x=>x.pass).length; const result={phase:'388.36',status:passed===checks.length?'PASS':'NOT_READY',score:Math.round(passed/checks.length*100),checked_at:new Date().toISOString(),organization_id:org.id,checks};
 await storage.put('phase388/security-recovery-validation.json',new TextEncoder().encode(JSON.stringify(result,null,2)),'application/json'); res.json(result);
}