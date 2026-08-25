import { db } from "hatchable";
export const access = "admin";
export const methods = ["GET"];
export default async function(req,res){
 const names=['gis_geometry_sources','gis_geometry_features','gis_spatial_identity_evidence','gis_identity_resolution_results','gis_evidence_acquisition_queue'];
 const rows=[];
 for(const name of names){ const r=await db.query(`SELECT to_regclass($1) AS table_name`,[name]); const exists=!!r.rows[0]?.table_name; let count=0; if(exists){const c=await db.query(`SELECT COUNT(*)::int AS n FROM ${name}`); count=c.rows[0].n;} rows.push({table:name,exists,count}); }
 const ok=rows.every(x=>x.exists);
 return res.json({phase:'335.6',status:ok?'SCHEMA_READY':'SCHEMA_INCOMPLETE',tables:rows,next:ok?'IMPORT_AUTHORITATIVE_GRID3_DATA':'REPAIR_MIGRATIONS'});
}