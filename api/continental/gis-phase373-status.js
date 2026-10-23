import { db } from "hatchable";
export const access = "admin";
export const methods=["GET"];
export default async function(req,res){const q=await db.query(`SELECT dataset_key,layer_name,fetch_offset,page_size,status,total_loaded,last_error,last_run_at,updated_at FROM gis_phase373_fetch_jobs ORDER BY dataset_key`);return res.json({phase:373,jobs:q.rows,assertions:{lgaWardEnabled:false},status:q.rows.length?'PIPELINE_ACTIVE':'NOT_BOOTSTRAPPED'});}