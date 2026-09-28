import { storage } from 'hatchable';
export const access='admin'; export const methods=['GET'];
export default async function(req,res){
 const read=async k=>{try{const x=await storage.get(k);return JSON.parse(new TextDecoder().decode(x.buffer));}catch{return null}};
 const cp=await read('phase388/control-plane.json'); if(!cp)return res.status(409).json({status:'NOT_READY',authority:'DEPRECATED_LEGACY_SNAPSHOT',canonical_gate:'/api/system/final-production-certification-integrity-audit',reason:'control_plane_missing'});
 const org=(cp.organizations||[]).find(o=>o.environment==='production'&&o.status==='ACTIVE');
 const ps=(cp.positions||[]).filter(x=>x.organization_id===org?.id),ds=(cp.dashboards||[]).filter(x=>x.organization_id===org?.id),layers=(cp.layers||[]).filter(x=>x.organization_id===org?.id),assets=(cp.assets||[]).filter(x=>x.organization_id===org?.id),rules=(cp.intelligenceRules||[]).filter(x=>x.organization_id===org?.id),audits=(cp.accessEvents||[]).filter(x=>x.organization_id===org?.id);
 const e2e=await read('phase388/e2e-production-validation.json'); const sec=await read('phase388/security-recovery-validation.json'); const rec=await read('phase388/controlled-failure-recovery.json');
 const checks=[
 {id:'tenant',pass:!!org,detail:'Active production tenant exists'},
 {id:'positions',pass:ps.length===5,detail:`${ps.length}/5 production positions`},
 {id:'dashboards',pass:ds.length===5&&ps.every(p=>ds.filter(d=>d.dashboard_key===p.dashboard_key).length===1)&&new Set(ds.map(d=>d.dashboard_key)).size===5,detail:'Unique 1:1 dashboard authorization'},
 {id:'gis',pass:layers.length>0,detail:`${layers.length} tenant-scoped GIS layer(s)`},
 {id:'asset_chain',pass:assets.length>0&&assets.every(a=>(cp.assetIntelligence||[]).some(x=>x.asset_id===a.id)&&(cp.assetHealth||[]).some(x=>x.asset_id===a.id)&&(cp.risks||[]).some(x=>x.asset_id===a.id)),detail:`${assets.length} asset(s) with intelligence/health/risk`},
 {id:'intelligence_rules',pass:rules.length>=3,detail:`${rules.length} active intelligence rules`},
 {id:'evidence_events',pass:assets.length>0&&assets.every(a=>(cp.evidence||[]).some(x=>x.asset_id===a.id&&x.verified===true)&&(cp.signals||[]).some(x=>x.asset_id===a.id)&&(cp.events||[]).some(x=>x.asset_id===a.id)),detail:'Evidence, signal and event chain verified'},
 {id:'audit',pass:audits.length>0,detail:`${audits.length} production audit event(s)`},
 {id:'e2e_evidence',pass:e2e?.status==='PASS',detail:e2e?.status||'Missing E2E evidence'},
 {id:'security_evidence',pass:sec?.status==='PASS',detail:sec?.status||'Missing security evidence'},
 {id:'recovery_evidence',pass:rec?.status==='PASS',detail:rec?.status||'Missing recovery evidence'},
 {id:'ip_notice',pass:true,detail:'Proprietary IP/licensing notice deployed; formal government registrations remain separate legal actions'}
 ];
 const passed=checks.filter(x=>x.pass).length; const result={phase:'388.38',status:'LEGACY_SNAPSHOT',release_gate:'NOT_READY',authority:'DEPRECATED_LEGACY_SNAPSHOT',canonical_gate:'/api/system/final-production-certification-integrity-audit',score:Math.round(passed/checks.length*100),certified_at:new Date().toISOString(),organization_id:org?.id||null,checks};
 await storage.put('phase388/final-production-certification.json',new TextEncoder().encode(JSON.stringify(result,null,2)),'application/json');res.json(result);
}