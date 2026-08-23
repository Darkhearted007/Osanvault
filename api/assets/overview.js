import { db } from "hatchable";
export const access = "admin";
export const methods = ["GET"];
export default async function(req,res){
 const {rows:[summary]}=await db.query(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status='Active')::int AS active, COUNT(*) FILTER (WHERE condition IN ('Poor','Critical'))::int AS attention, COALESCE(SUM(current_value),0)::numeric AS current_value FROM corporate_assets`);
 const {rows:categories}=await db.query(`SELECT category, COUNT(*)::int AS count FROM corporate_assets GROUP BY category ORDER BY count DESC`);
 const {rows:assets}=await db.query(`SELECT id,asset_code,name,category,asset_image_url,location,custodian_name,condition,status,current_value,currency FROM corporate_assets ORDER BY created_at DESC LIMIT 50`);
 res.json({summary,categories,assets});
}