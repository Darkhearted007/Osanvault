import { db } from "hatchable";
export const access = "admin";
export const methods=["GET"];
export default async function(req,res){const q=await db.query(`SELECT dataset_key,download_url,format,status,provenance,updated_at FROM gis_phase376_datahub_sources ORDER BY dataset_key`);return res.json({phase:377,sources:q.rows,assertions:{lgaWardEnabled:false}})}