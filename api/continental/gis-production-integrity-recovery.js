import { db } from "hatchable";
export const access = "admin";
export const methods = ["GET"];
export default async function(req,res){
  const names=['gis_geometry_sources','gis_geometry_features','gis_spatial_identity_evidence','gis_spatial_intersection_evidence','gis_identity_resolution_results','gis_evidence_acquisition_queue'];
  const {rows}=await db.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name = ANY($1::text[]) ORDER BY table_name`,[names]);
  const migrations=await db.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name ILIKE '%hatchable%'`);
  return res.json({phase:'335.5',status:rows.length===names.length?'READY':'SCHEMA_RECOVERY_REQUIRED',expected_tables:names,found_tables:rows.map(x=>x.table_name),migration_metadata_tables:migrations.rows.map(x=>x.table_name),note:'No certification changes are permitted until the production GIS schema and evidence data are verified.'});
}