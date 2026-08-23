import { db } from "hatchable";
export const access = "admin";
export const methods = ["GET"];
export default async function(req,res){
 const departments=await db.query("SELECT d.id,d.code,d.name,d.purpose,d.status,COUNT(p.id)::int AS position_count,COALESCE(SUM(p.approved_headcount),0)::int AS approved_headcount,COALESCE(SUM(p.filled_headcount),0)::int AS filled_headcount FROM org_departments d LEFT JOIN org_positions p ON p.department_id=d.id GROUP BY d.id ORDER BY d.name");
 const positions=await db.query("SELECT p.id,p.position_code,p.title,p.level,p.purpose,p.responsibilities,p.required_skills,p.approved_headcount,p.filled_headcount,p.status,d.name AS department_name,m.title AS reports_to_title FROM org_positions p LEFT JOIN org_departments d ON d.id=p.department_id LEFT JOIN org_positions m ON m.id=p.reports_to_position_id ORDER BY d.name,p.level,p.title");
 res.json({departments:departments.rows,positions:positions.rows});
}