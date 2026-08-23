import { db } from "hatchable";
export const access = "admin";
export const methods = ["GET"];
export default async function(req,res){const {rows}=await db.query("SELECT id,title,category,principle,protected,status FROM governance_principles WHERE status='Active' ORDER BY id");res.json(rows)}