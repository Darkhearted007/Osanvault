import { db } from 'hatchable';
export const access='admin';
export const methods=['GET'];
const required=[
 ['security_controls','security_controls'],['tenant_security_controls','tenant_security_controls'],
 ['commercial_plans','commercial_plans'],['commercial_entitlements','commercial_entitlements'],
 ['commercial_invoices','commercial_invoices'],['commercial_payment_events','commercial_payment_events'],
 ['commercial_payment_intents','commercial_payment_intents'],['commercial_subscriptions','commercial_subscriptions'],
 ['treasury_accounts','treasury_accounts'],['treasury_transactions','treasury_transactions'],
 ['share_ledger','share_ledger'],['admin_approvals','admin_approvals'],['audit_findings','audit_findings'],
 ['verification_cases','verification_cases'],['verification_decisions','verification_decisions']
];
export default async function(req,res){
 const checks=[]; const blockers=[];
 const dbid=(await db.query('SELECT current_database() AS database_name,current_schema() AS schema_name')).rows[0];
 for(const [name,table] of required){
  try{
   const e=(await db.query("SELECT COUNT(*)::int AS n FROM information_schema.tables WHERE table_schema=current_schema() AND table_name=$1",[table])).rows[0].n;
   if(e!==1){checks.push({name,status:'BLOCKED',reason:'TABLE_NOT_VISIBLE'});blockers.push({name,reason:'TABLE_NOT_VISIBLE'});continue;}
   const n=(await db.query(`SELECT COUNT(*)::int AS n FROM ${table}`)).rows[0].n;
   checks.push({name,status:'PASS',rowCount:n});
  }catch(err){checks.push({name,status:'BLOCKED',error:String(err?.message||err)});blockers.push({name,error:String(err?.message||err)});}
 }
 const controls=checks.filter(x=>['security_controls','tenant_security_controls'].includes(x.name));
 if(controls.some(x=>x.rowCount===0)) blockers.push({name:'security_control_baseline',reason:'NO_CONTROL_RECORDS'});
 const decision=blockers.length?'NOT_READY':'OBSERVED_READY_FOR_DEEPER_TESTS';
 const r=await db.query('INSERT INTO business_security_hardening_audits(phase,checks,blockers,decision,production_gate,notes) VALUES($1,$2,$3,$4,$5,$6) RETURNING id',['391.5',JSON.stringify(checks),JSON.stringify(blockers),decision,'NOT_READY','Observation-only audit; no financial, tenant, verification, or approval records were mutated.']);
 res.status(blockers.length?409:200).json({phase:'391.5',auditId:r.rows[0].id,database:dbid,checks,blockers,decision,production_gate:'NOT_READY'});
}