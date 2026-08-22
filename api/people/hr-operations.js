import { db } from 'hatchable';
export const access='admin'; export const methods=['GET'];
export default async function(req,res){
 const [w,r,a,c]=await Promise.all([
 db.query(`SELECT COUNT(*)::int employees, COUNT(*) FILTER (WHERE lifecycle_status='active')::int active, COUNT(*) FILTER (WHERE lifecycle_status='onboarding')::int onboarding, COUNT(*) FILTER (WHERE lifecycle_status='inactive')::int inactive FROM people_records WHERE person_type='employee'`),
 db.query(`SELECT request_type AS type, COUNT(*)::int count FROM employee_requests WHERE status='pending' GROUP BY request_type ORDER BY count DESC`),
 db.query(`SELECT id,person_id,alert_type,severity,due_date,title,details FROM employee_alerts WHERE status='open' ORDER BY due_date NULLS LAST LIMIT 50`),
 db.query(`SELECT id,name,start_date,end_date,due_date,status FROM performance_cycles ORDER BY start_date DESC LIMIT 10`)
 ]); res.json({ok:true,workforce:w.rows[0],pendingRequests:r.rows,alerts:a.rows,performanceCycles:c.rows});
}