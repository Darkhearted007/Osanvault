import { db } from "hatchable";
export const access = "admin";
export const methods=["GET"];
export default async function(req,res){const q=await db.query(`SELECT root_url,status,metadata,checked_at FROM gis_phase374_adapter_discovery ORDER BY checked_at DESC`);return res.json({phase:374,checked:q.rows.length,sources:q.rows,assertions:{lgaWardEnabled:false}})}