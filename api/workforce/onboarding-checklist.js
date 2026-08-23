import { db } from "hatchable";
export const access = "admin";
export const methods = ["GET"];
export default async function(req,res){
 const employeeId=req.query?.employee_id;
 if(!employeeId) return res.status(400).json({error:"employee_id is required"});
 const {rows}=await db.query("SELECT id, employee_id, item_key, item_label, status, completed_at, notes FROM employee_onboarding_checklist WHERE employee_id=$1 ORDER BY item_order",[employeeId]);
 res.json({employee_id:employeeId,items:rows});
}