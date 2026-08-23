import { db } from "hatchable";
export const access = "admin";
export const methods = ["GET"];
export default async function(req,res){
 const employeeId=req.query?.employee_id;
 if(!employeeId) return res.status(400).json({error:"employee_id is required"});
 const master=await db.query("SELECT * FROM employee_master_records WHERE employee_id=$1",[employeeId]);
 if(!master.rows.length) return res.status(404).json({error:"Employee master record not found"});
 const assets=await db.query("SELECT a.id,a.asset_code,a.name,a.category,a.asset_image_url,a.location,a.condition,a.status,aa.assigned_at FROM asset_assignments aa JOIN corporate_assets a ON a.id=aa.asset_id WHERE aa.employee_id=$1 AND aa.returned_at IS NULL ORDER BY aa.assigned_at DESC",[employeeId]);
 const onboarding=await db.query("SELECT item_key,item_label,status,completed_at,notes FROM employee_onboarding_checklist WHERE employee_id=$1 ORDER BY item_order",[employeeId]);
 res.json({employee:master.rows[0],assets:assets.rows,onboarding:onboarding.rows});
}