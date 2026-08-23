import { db } from "hatchable";
export const access = "admin";
export const methods = ["GET"];
export default async function(req,res){
 const departments=await db.query("SELECT d.id,d.name,d.description AS purpose,d.status,COUNT(p.id)::int AS position_count,COUNT(p.id)::int AS approved_headcount,0::int AS filled_headcount FROM org_departments d LEFT JOIN org_positions p ON p.department_id=d.id GROUP BY d.id,d.name,d.description,d.status ORDER BY d.name");
 const positions=await db.query("SELECT p.id,p.id::text AS position_code,p.title,p.level,p.description AS purpose,p.responsibilities,p.required_skills,1::int AS approved_headcount,0::int AS filled_headcount,p.status,d.name AS department_name,m.title AS reports_to_title FROM org_positions p LEFT JOIN org_departments d ON d.id=p.department_id LEFT JOIN org_positions m ON m.id=p.reports_to_position_id ORDER BY d.name,p.level,p.title");
 res.json({departments:departments.rows,positions:positions.rows});
}