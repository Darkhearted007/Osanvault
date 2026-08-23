import { db } from "hatchable";
export const access = "admin";
export const methods = ["GET"];
export default async function(req,res){
 const { rows } = await db.query(`SELECT a.id,a.employee_id,a.position_id,a.assignment_type,a.employment_status,a.start_date,a.end_date,a.appointment_title,a.appointment_scope,a.notes,p.title AS position_title,p.level,d.name AS department_name,m.title AS reports_to_title FROM position_assignments a JOIN org_positions p ON p.id=a.position_id LEFT JOIN org_departments d ON d.id=p.department_id LEFT JOIN org_positions m ON m.id=a.reporting_position_id ORDER BY a.start_date DESC`);
 res.json({assignments:rows});
}