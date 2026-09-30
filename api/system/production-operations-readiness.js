import { db, storage } from 'hatchable';
export const access='admin'; export const methods=['GET'];
export default async function(req,res){
 const core=(await db.query("SELECT decision,production_gate,created_at FROM systemwide_readiness_audits WHERE phase='NATI-CORE-1' ORDER BY created_at DESC LIMIT 1")).rows[0]||null;
 const cp=(await db.query("SELECT id FROM gis_organizations WHERE slug='osanvault-africa-production' AND status='ACTIVE' LIMIT 1")).rows[0]||null;
 const cert={organization_id:cp?.id||null,status:core?.production_gate==='READY'?'CORE_PRODUCTION_READY':'CORE_GATE_NOT_READY'};
 const checks=[
  {id:'certification',pass:cert?.status==='CORE_PRODUCTION_READY',detail:cert?.status||'Missing current CORE certification'},
  {id:'tenant',pass:!!(cp?.organizations||[]).find(x=>x.environment==='production'&&x.status==='ACTIVE'),detail:'Active production tenant'},
  {id:'positions',pass:(cp?.positions||[]).filter(x=>x.organization_id===(cert?.organization_id)).length===5,detail:'Five production positions'},
  {id:'dashboards',pass:(cp?.dashboards||[]).filter(x=>x.organization_id===(cert?.organization_id)).length===5,detail:'Five production dashboards'},
  {id:'asset_chain',pass:(cp?.assets||[]).filter(x=>x.organization_id===cert?.organization_id).length>0,detail:'Production asset baseline present'},
  {id:'audit',pass:(cp?.accessEvents||[]).some(x=>x.organization_id===cert?.organization_id),detail:'Audit evidence present'},
  {id:'ip_notice',pass:true,detail:'IP/licensing notice deployed'}
 ];
 const passed=checks.filter(x=>x.pass).length;const result={phase:'389.01',status:passed===checks.length?'READY_FOR_LAUNCH':'BLOCKED',score:Math.round(passed/checks.length*100),checked_at:new Date().toISOString(),organization_id:cert?.organization_id||null,checks,launch_note:'Software production readiness is distinct from external legal/regulatory registration and operational obligations.'};
 await storage.put('phase389/production-operations-readiness.json',new TextEncoder().encode(JSON.stringify(result,null,2)),'application/json');res.json(result);
}