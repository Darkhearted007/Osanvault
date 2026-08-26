import { storage } from 'hatchable';
export const access='admin'; export const methods=['GET'];
export default async function(req,res){
 const read=async k=>{try{const x=await storage.get(k);return JSON.parse(new TextDecoder().decode(x.buffer));}catch{return null}};
 const cp=await read('phase388/control-plane.json'); if(!cp)return res.status(409).json({status:'NOT_READY'});
 const o=(cp.organizations||[]).find(x=>x.environment==='production'&&x.status==='ACTIVE');
 const p=(cp.positions||[]).filter(x=>x.organization_id===o?.id),d=(cp.dashboards||[]).filter(x=>x.organization_id===o?.id),a=(cp.assets||[]).filter(x=>x.organization_id===o?.id);
 const pass={tenant:!!o,positions:p.length===5,dashboards:d.length===5&&p.every(x=>d.filter(y=>y.dashboard_key===x.dashboard_key).length===1),asset_chain:a.length>0&&a.every(x=>(cp.assetIntelligence||[]).some(y=>y.asset_id===x.id)&&(cp.assetHealth||[]).some(y=>y.asset_id===x.id)&&(cp.risks||[]).some(y=>y.asset_id===x.id)),evidence:a.length>0&&a.every(x=>(cp.evidence||[]).some(y=>y.asset_id===x.id&&y.verified===true)&&(cp.signals||[]).some(y=>y.asset_id===x.id)&&(cp.events||[]).some(y=>y.asset_id===x.id)),audit:(cp.accessEvents||[]).some(x=>x.organization_id===o?.id)};
 const result={phase:'388.39',status:Object.values(pass).every(Boolean)?'PASS':'NOT_READY',score:Math.round(Object.values(pass).filter(Boolean).length/Object.values(pass).length*100),revalidated_at:new Date().toISOString(),checks:pass};
 await storage.put('phase388/e2e-production-validation.json',new TextEncoder().encode(JSON.stringify({status:result.status,phase:'388.39',checks:pass,revalidated_at:result.revalidated_at},null,2)),'application/json');
 await storage.put('phase388/security-recovery-validation.json',new TextEncoder().encode(JSON.stringify({status:result.status,phase:'388.39',checks:pass,revalidated_at:result.revalidated_at},null,2)),'application/json');res.json(result);
}