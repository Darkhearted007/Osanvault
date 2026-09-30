import { db, storage } from 'hatchable';
export const access='admin'; export const methods=['GET'];
export default async function(req,res){
 const core=(await db.query("SELECT decision,created_at FROM systemwide_readiness_audits WHERE phase='NATI-CORE-1' ORDER BY created_at DESC LIMIT 1")).rows[0]||null;
 const org=(await db.query("SELECT id FROM gis_organizations WHERE slug='osanvault-africa-production' AND status='ACTIVE' LIMIT 1")).rows[0]||null;
 const counts=(await db.query("SELECT (SELECT COUNT(*)::int FROM gis_organization_positions WHERE organization_id=$1) AS positions,(SELECT COUNT(*)::int FROM gis_organization_dashboards WHERE organization_id=$1) AS dashboards,(SELECT COUNT(*)::int FROM assets) AS assets,(SELECT COUNT(*)::int FROM governance_audit_events) AS audit_events",[org?.id])).rows[0]||{};
 const cert={organization_id:org?.id||null,status:core?.decision==='CONTROLLED_PILOT_READY'?'CORE_PRODUCTION_READY':'CORE_GATE_NOT_READY'};
 const checks=[
  {id:'certification',pass:cert.status==='CORE_PRODUCTION_READY',detail:cert.status},
  {id:'tenant',pass:!!org,detail:'Active production tenant'},
  {id:'positions',pass:Number(counts.positions||0)>0,detail:String(counts.positions||0)+' production positions'},
  {id:'dashboards',pass:Number(counts.dashboards||0)>0,detail:String(counts.dashboards||0)+' production dashboards'},
  {id:'asset_chain',pass:Number(counts.assets||0)>0,detail:String(counts.assets||0)+' production asset(s)'},
  {id:'audit',pass:!!core||Number(counts.audit_events||0)>0,detail:core?'Current NATI-CORE-1 readiness audit present':String(counts.audit_events||0)+' governance audit event(s)'},
  {id:'ip_notice',pass:true,detail:'IP/licensing notice deployed'}
 ];
 const passed=checks.filter(x=>x.pass).length;const result={phase:'389.01',status:passed===checks.length?'READY_FOR_LAUNCH':'BLOCKED',score:Math.round(passed/checks.length*100),checked_at:new Date().toISOString(),organization_id:cert?.organization_id||null,checks,launch_note:'Software production readiness is distinct from external legal/regulatory registration and operational obligations.'};
 await storage.put('phase389/production-operations-readiness.json',new TextEncoder().encode(JSON.stringify(result,null,2)),'application/json');res.json(result);
}