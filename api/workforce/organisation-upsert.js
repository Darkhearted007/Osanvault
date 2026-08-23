import { db } from "hatchable";
export const access = "admin";
export const methods = ["POST"];
export default async function(req,res){
 const b=req.body||{};
 if(!b.position_code||!b.title) return res.status(400).json({error:"position_code and title are required"});
 const {rows}=await db.query(`INSERT INTO org_positions (position_code,title,department_id,reports_to_position_id,employment_type,level,purpose,responsibilities,required_skills,approved_headcount,status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT(position_code) DO UPDATE SET title=EXCLUDED.title,department_id=EXCLUDED.department_id,reports_to_position_id=EXCLUDED.reports_to_position_id,employment_type=EXCLUDED.employment_type,level=EXCLUDED.level,purpose=EXCLUDED.purpose,responsibilities=EXCLUDED.responsibilities,required_skills=EXCLUDED.required_skills,approved_headcount=EXCLUDED.approved_headcount,status=EXCLUDED.status,updated_at=now() RETURNING *`,[b.position_code,b.title,b.department_id||null,b.reports_to_position_id||null,b.employment_type||'Full-time',b.level||null,b.purpose||null,b.responsibilities||null,b.required_skills||null,Number(b.approved_headcount||1),b.status||'Approved']);
 res.json(rows[0]);
}