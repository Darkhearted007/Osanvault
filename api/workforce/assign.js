import { db } from "hatchable";
export const access = "admin";
export const methods = ["POST"];
export default async function(req,res){
 const b=req.body||{};
 if(!b.position_id||!b.employee_id) return res.status(400).json({error:"position_id and employee_id are required"});
 const {rows}=await db.query(`INSERT INTO position_assignments (position_id,employee_id,assignment_type,employment_status,start_date,end_date,appointment_title,appointment_scope,reporting_position_id,notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,[b.position_id,b.employee_id,b.assignment_type||'Primary',b.employment_status||'Active',b.start_date||new Date().toISOString().slice(0,10),b.end_date||null,b.appointment_title||null,b.appointment_scope||null,b.reporting_position_id||null,b.notes||null]);
 res.status(201).json(rows[0]);
}