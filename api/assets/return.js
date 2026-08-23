import { db } from "hatchable";
export const access = "admin";
export const methods = ["POST"];
export default async function(req,res){
 const b=req.body||{}; if(!b.asset_id) return res.status(400).json({error:"asset_id is required"});
 const {rows}=await db.query("UPDATE asset_assignments SET returned_at=now(),return_condition=$1,notes=COALESCE($2,notes) WHERE asset_id=$3 AND returned_at IS NULL RETURNING id,asset_id,employee_id,returned_at",[b.return_condition||null,b.notes||null,b.asset_id]);
 if(!rows.length) return res.status(404).json({error:"No active assignment found"});
 await db.query("UPDATE corporate_assets SET status='Active',custodian_name=NULL,updated_at=now() WHERE id=$1",[b.asset_id]);
 res.json(rows[0]);
}