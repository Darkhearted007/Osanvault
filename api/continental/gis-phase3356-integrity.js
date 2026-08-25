import { db } from "hatchable";
export const access = "admin";
export const methods = ["GET"];
export default async function(req,res){
 const names=['gis_geometry_sources','gis_geometry_features','gis_spatial_identity_evidence','gis_identity_resolution_results','gis_evidence_acquisition_queue'];
 const schema=(await db.query(`SELECT current_schema() AS schema`)).rows[0].schema;
 const catalog=await db.query(`SELECT table_name FROM information_schema.tables WHERE table_schema=current_schema() AND table_name = ANY($1::text[])`,[names]);
 const present=new Set(catalog.rows.map(x=>x.table_name));
 const rows=[];
 for(const name of names){ let count=0; if(present.has(name)){const c=await db.query(`SELECT COUNT(*)::int AS n FROM ${name}`); count=c.rows[0].n;} rows.push({table:name,exists:present.has(name),count}); }
 const ok=rows.every(x=>x.exists);
 return res.json({phase:'335.6',schema,status:ok?'SCHEMA_READY':'SCHEMA_INCOMPLETE',tables:rows,next:ok?'VERIFY_AND_IMPORT_AUTHORITATIVE_GRID3_DATA':'REPAIR_MIGRATIONS'});
}