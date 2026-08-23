import { db } from "hatchable";
export const access = "admin";
export const methods = ["POST"];
export default async function(req,res){
 const b=req.body||{}; if(!b.asset_id||!b.employee_id) return res.status(400).json({error:"asset_id and employee_id are required"});
 const existing=await db.query("SELECT id FROM asset_assignments WHERE asset_id=$1 AND returned_at IS NULL",[b.asset_id]);
 if(existing.rows.length) return res.status(409).json({error:"Asset is already assigned",assignment_id:existing.rows[0].id});
 const {rows}=await db.query("INSERT INTO asset_assignments(asset_id,employee_id,assigned_by,notes) VALUES($1,$2,$3,$4) RETURNING id,asset_id,employee_id,assigned_at",[b.asset_id,b.employee_id,req.member?.email||req.member?.handle||"admin",b.notes||null]);
 await db.query("UPDATE corporate_assets SET status='Assigned',custodian_name=$1,updated_at=now() WHERE id=$2",[b.employee_name||b.employee_id,b.asset_id]);
 res.status(201).json(rows[0]);
}