import { db } from "hatchable";
export const access = "admin";
export const methods = ["POST"];
export default async function(req,res){
 const b=req.body||{};
 if(!b.employee_id||!b.item_key) return res.status(400).json({error:"employee_id and item_key are required"});
 const {rows}=await db.query("UPDATE employee_onboarding_checklist SET status=$1,completed_at=CASE WHEN $1='Completed' THEN now() ELSE NULL END,notes=$2,updated_at=now() WHERE employee_id=$3 AND item_key=$4 RETURNING *",[b.status||"Completed",b.notes||null,b.employee_id,b.item_key]);
 if(!rows.length) return res.status(404).json({error:"Checklist item not found"});
 res.json(rows[0]);
}