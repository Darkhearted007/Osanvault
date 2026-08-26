import { storage } from 'hatchable';
export const access='admin'; export const methods=['GET'];
export default async function(req,res){
 const read=async k=>{try{const x=await storage.get(k);return JSON.parse(new TextDecoder().decode(x.buffer))}catch{return null}};
 const op=await read('phase389/production-operations-readiness.json'); const rec=await read('phase389/backup-recovery/result.json'); const mon=await read('phase389/monitoring/incident-readiness.json'); const smoke=await read('phase389/smoke-performance/result.json'); const legal=await read('phase389/legal-regulatory-readiness.json');
 const checks=[
 {id:'operations',pass:op?.status==='READY_FOR_LAUNCH',detail:op?.status||'Missing'},
 {id:'recovery',pass:rec?.status==='PASS',detail:rec?.status||'Missing'},
 {id:'monitoring',pass:mon?.status==='PASS',detail:mon?.status||'Missing'},
 {id:'smoke',pass:smoke?.status==='PASS',detail:smoke?.status||'Missing'},
 {id:'legal_gate',pass:legal?.status==='APPROVED_FOR_COMMERCIAL_LAUNCH',detail:legal?.status||'Legal review required'},
 {id:'regulated_features',pass:false,detail:'Tokenized investment, custody, exchange, advisory and other regulated features remain disabled until the applicable Nigerian regulatory pathway is completed'},
 {id:'payments',pass:false,detail:'No regulated payment/custody activation without the applicable licensing/partner pathway'}
 ];
 const passed=checks.filter(x=>x.pass).length; const result={phase:'389.07',status:passed===checks.length?'COMMERCIAL_LAUNCH_READY':'COMMERCIAL_LAUNCH_GATED',score:Math.round(passed/checks.length*100),checked_at:new Date().toISOString(),checks,launch_mode:'controlled',enabled_scope:['public product information','non-regulated onboarding','demo/read-only asset intelligence where legally appropriate'],disabled_scope:['public investment solicitation','tokenized securities/RWA offering','custody/exchange','investment advice','regulated payment services']};
 await storage.put('phase389/commercial-launch-readiness.json',new TextEncoder().encode(JSON.stringify(result,null,2)),'application/json');res.json(result);
}