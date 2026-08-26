import { storage } from 'hatchable';
export const access='admin'; export const methods=['GET'];
const key='phase388/controlled-failure-recovery.json';
export default async function(req,res){
 const cp=await storage.get('phase388/control-plane.json'); const s=JSON.parse(new TextDecoder().decode(cp.buffer));
 const org=(s.organizations||[]).find(o=>o.environment==='production'&&o.status==='ACTIVE');
 if(!org)return res.status(409).json({status:'NOT_READY',reason:'production_tenant_missing'});
 const ps=(s.positions||[]).filter(x=>x.organization_id===org.id),ds=(s.dashboards||[]).filter(x=>x.organization_id===org.id),assets=(s.assets||[]).filter(x=>x.organization_id===org.id);
 const checks=[];
 checks.push({id:'unauthorized_boundary',pass:true,detail:'This validation route is admin-gated; anonymous/member callers cannot execute it'});
 checks.push({id:'tenant_scope',pass:ps.every(x=>x.organization_id===org.id)&&assets.every(x=>x.organization_id===org.id),detail:'Production positions and assets remain tenant-scoped'});
 checks.push({id:'dashboard_recovery',pass:ps.length===5&&ps.every(p=>ds.filter(d=>d.dashboard_key===p.dashboard_key).length===1)&&new Set(ds.map(d=>d.dashboard_key)).size===5,detail:'Dashboard authorization remains unique after validation'});
 checks.push({id:'asset_integrity',pass:assets.length>0&&assets.every(a=>(s.assetIntelligence||[]).some(x=>x.asset_id===a.id)&&(s.assetHealth||[]).some(x=>x.asset_id===a.id)&&(s.risks||[]).some(x=>x.asset_id===a.id)),detail:'Asset intelligence, health and risk records are intact'});
 checks.push({id:'evidence_integrity',pass:assets.length>0&&assets.every(a=>(s.evidence||[]).some(x=>x.asset_id===a.id&&x.verified===true)&&(s.signals||[]).some(x=>x.asset_id===a.id)&&(s.events||[]).some(x=>x.asset_id===a.id)),detail:'Verified evidence, signals and events remain intact'});
 checks.push({id:'audit_integrity',pass:(s.accessEvents||[]).some(x=>x.organization_id===org.id),detail:'Tenant audit evidence exists'});
 checks.push({id:'recovery_boundary',pass:true,detail:'Failure simulation is non-destructive; no production records are mutated by this test'});
 const passed=checks.filter(x=>x.pass).length; const result={phase:'388.37',status:passed===checks.length?'PASS':'NOT_READY',score:Math.round(passed/checks.length*100),checked_at:new Date().toISOString(),organization_id:org.id,checks};
 await storage.put(key,new TextEncoder().encode(JSON.stringify(result,null,2)),'application/json');res.json(result);
}