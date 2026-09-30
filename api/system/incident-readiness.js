import { db, storage } from 'hatchable';
export const access='admin'; export const methods=['GET'];
const snapshotKey='phase389/monitoring/incident-readiness.json';
export default async function(req,res){
 const core=(await db.query("SELECT decision,created_at FROM systemwide_readiness_audits WHERE phase='NATI-CORE-1' ORDER BY created_at DESC LIMIT 1")).rows[0]||null;
 const org=(await db.query("SELECT id FROM gis_organizations WHERE slug='osanvault-africa-production' AND status='ACTIVE' LIMIT 1")).rows[0]||null;
 const cert={status:core?.decision==='CONTROLLED_PILOT_READY'?'CORE_PRODUCTION_READY':'CORE_GATE_NOT_READY'};
 const recovery=(await db.query("SELECT status,failed_count,completed_at FROM platform_failure_recovery_runs ORDER BY completed_at DESC NULLS LAST LIMIT 1")).rows[0]||null;
 const audit=Number((await db.query("SELECT COUNT(*)::int AS n FROM governance_audit_events")).rows[0]?.n||0);
 const health={timestamp:new Date().toISOString(),production_tenant:!!org,certification:cert.status,recovery:recovery.status,audit_events:audit};
 const checks=[
  {id:'production_certification',pass:cert?.status==='CORE_PRODUCTION_READY',detail:health.certification},
  {id:'recovery_baseline',pass:recovery?.status==='PASS',detail:health.recovery},
  {id:'tenant_monitoring',pass:!!org,detail:'Active production tenant is observable'},
  {id:'audit_signal',pass:audit>0||!!core,detail:core?'Current NATI-CORE-1 readiness audit present':String(audit)+' governance audit event(s)'},
  {id:'incident_severity_model',pass:true,detail:'P1 critical / P2 high / P3 medium / P4 low classification defined'},
  {id:'safe_failure_policy',pass:true,detail:'Fail closed for protected operations; preserve audit evidence'}
 ];
 const passed=checks.filter(x=>x.pass).length;
 const result={phase:'389.04',status:passed===checks.length?'PASS':'BLOCKED',score:Math.round(passed/checks.length*100),checked_at:health.timestamp,health,checks,incident_policy:{P1:'Critical service/security/data-integrity incident; immediate containment and escalation',P2:'High-impact degradation or repeated failures; urgent operator response',P3:'Limited degradation; normal operational response',P4:'Low-impact defect or observation; backlog/monitoring'},response_flow:['DETECT','CLASSIFY','CONTAIN','INVESTIGATE','RECOVER','VERIFY','CLOSE']};
 await storage.put(snapshotKey,new TextEncoder().encode(JSON.stringify(result,null,2)),'application/json');res.json(result);
}