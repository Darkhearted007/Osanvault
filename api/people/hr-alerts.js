import { db } from 'hatchable';
export const access='scheduler';
export const schedule='0 8 * * *';
export default async function(req,res){
 const {rows:contracts}=await db.query(`SELECT ec.person_id,ec.end_date,pr.full_name FROM employee_contracts ec JOIN people_records pr ON pr.id=ec.person_id WHERE ec.end_date IS NOT NULL AND ec.end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '45 days' AND pr.person_type='employee'`);
 for(const x of contracts){await db.query(`INSERT INTO employee_alerts(person_id,alert_type,severity,due_date,title,details) SELECT $1,'contract_expiry','warning',$2,$3,$4 WHERE NOT EXISTS (SELECT 1 FROM employee_alerts WHERE person_id=$1 AND alert_type='contract_expiry' AND due_date=$2)`,[x.person_id,x.end_date,`Contract expiry: ${x.full_name}`,`Employment contract expires on ${x.end_date}. Review renewal or exit action.`]);}
 const {rows:training}=await db.query(`SELECT et.person_id,et.expiry_date,pr.full_name,et.training_name FROM employee_training et JOIN people_records pr ON pr.id=et.person_id WHERE et.expiry_date IS NOT NULL AND et.expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '60 days' AND pr.person_type='employee'`);
 for(const x of training){await db.query(`INSERT INTO employee_alerts(person_id,alert_type,severity,due_date,title,details) SELECT $1,'certification_expiry','warning',$2,$3,$4 WHERE NOT EXISTS (SELECT 1 FROM employee_alerts WHERE person_id=$1 AND alert_type='certification_expiry' AND due_date=$2 AND title=$3)`,[x.person_id,x.expiry_date,`Certification expiry: ${x.training_name}`,`Certification for ${x.full_name} expires on ${x.expiry_date}.`]);}
 res.json({ok:true,contractAlerts:contracts.length,trainingAlerts:training.length});
}