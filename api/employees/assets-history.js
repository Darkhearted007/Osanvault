import { db } from "hatchable";
export const access = "admin";
export const methods = ["GET"];
export default async function(req,res){
 const employeeId=req.query?.employee_id; if(!employeeId) return res.status(400).json({error:"employee_id is required"});
 const {rows}=await db.query("SELECT aa.id,aa.asset_id,a.asset_code,a.name,a.category,a.asset_image_url,aa.assigned_at,aa.returned_at,aa.return_condition,aa.notes FROM asset_assignments aa JOIN corporate_assets a ON a.id=aa.asset_id WHERE aa.employee_id=$1 ORDER BY aa.assigned_at DESC",[employeeId]);
 res.json({employee_id:employeeId,history:rows});
}