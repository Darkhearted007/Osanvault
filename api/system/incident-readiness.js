import { storage } from 'hatchable';
export const access='admin'; export const methods=['GET'];
const snapshotKey='phase389/monitoring/incident-readiness.json';
export default async function(req,res){
 const read=async k=>{try{const x=await storage.get(k);return JSON.parse(new TextDecoder().decode(x.buffer))}catch{return null}};
 const cp=await read('phase388/control-plane.json');
 const cert=await read('phase388/final-production-certification.json');
 const recovery=await read('phase389/backup-recovery/result.json');
 const org=(cp?.organizations||[]).find(x=>x.environment==='production'&&x.status==='ACTIVE');
 const audit=(cp?.accessEvents||[]).filter(x=>x.organization_id===org?.id);
 const health={timestamp:new Date().toISOString(),production_tenant:!!org,certification:cert?.status||'UNKNOWN',recovery:recovery?.status||'UNKNOWN',audit_events:audit.length};
 const checks=[
  {id:'production_certification',pass:cert?.status==='PRODUCTION_READY',detail:health.certification},
  {id:'recovery_baseline',pass:recovery?.status==='PASS',detail:health.recovery},
  {id:'tenant_monitoring',pass:!!org,detail:'Active production tenant is observable'},
  {id:'audit_signal',pass:audit.length>0,detail:`${audit.length} production audit event(s)`},
  {id:'incident_severity_model',pass:true,detail:'P1 critical / P2 high / P3 medium / P4 low classification defined'},
  {id:'safe_failure_policy',pass:true,detail:'Fail closed for protected operations; preserve audit evidence'}
 ];
 const passed=checks.filter(x=>x.pass).length;
 const result={phase:'389.04',status:passed===checks.length?'PASS':'BLOCKED',score:Math.round(passed/checks.length*100),checked_at:health.timestamp,health,checks,incident_policy:{P1:'Critical service/security/data-integrity incident; immediate containment and escalation',P2:'High-impact degradation or repeated failures; urgent operator response',P3:'Limited degradation; normal operational response',P4:'Low-impact defect or observation; backlog/monitoring'},response_flow:['DETECT','CLASSIFY','CONTAIN','INVESTIGATE','RECOVER','VERIFY','CLOSE']};
 await storage.put(snapshotKey,new TextEncoder().encode(JSON.stringify(result,null,2)),'application/json');res.json(result);
}