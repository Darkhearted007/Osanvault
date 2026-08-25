import { db } from "hatchable";
export const access="public";
export const methods=["GET"];
export default async function(req,res){const q=await db.query(`SELECT dataset_key,provider,catalog_url,download_url,format,status,checksum,provenance,updated_at FROM gis_phase376_datahub_sources ORDER BY dataset_key`);return res.json({phase:376,sources:q.rows,assertions:{lgaWardEnabled:false}})}