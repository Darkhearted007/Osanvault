import { db } from "hatchable";
export const access = "admin";
export const methods = ["POST"];
export default async function(req,res){
 const b=req.body||{}; if(!b.asset_code||!b.name||!b.category) return res.status(400).json({error:"asset_code, name and category are required"});
 const {rows}=await db.query(`INSERT INTO corporate_assets (asset_code,name,category,description,asset_image_url,serial_number,acquisition_date,acquisition_cost,currency,current_value,location,custodian_name,department,condition,status,warranty_expiry,notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING *`,[b.asset_code,b.name,b.category,b.description||null,b.asset_image_url||null,b.serial_number||null,b.acquisition_date||null,b.acquisition_cost||null,b.currency||"NGN",b.current_value||null,b.location||null,b.custodian_name||null,b.department||null,b.condition||"Good",b.status||"Active",b.warranty_expiry||null,b.notes||null]);
 res.status(201).json(rows[0]);
}