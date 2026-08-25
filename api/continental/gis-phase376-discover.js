import { db } from "hatchable";
export const access="admin";
export const methods=["POST"];
const catalog='https://grid3.org/geospatial-data-nigeria';
const datasets=[['GRID3_STATE','STATE'],['GRID3_LGA','LGA'],['GRID3_WARD','WARD']];
export default async function(req,res){for(const [key,level] of datasets){await db.query(`INSERT INTO gis_phase376_datahub_sources(dataset_key,provider,catalog_url,status,provenance) VALUES($1,'GRID3',$2,'DISCOVERED',$3) ON CONFLICT(dataset_key) DO UPDATE SET catalog_url=EXCLUDED.catalog_url,updated_at=now(),provenance=EXCLUDED.provenance`,[key,catalog,JSON.stringify({phase:376,hierarchy:level,source:'GRID3 Nigeria Data Hub',assertionsEnabled:false})])}return res.json({phase:376,status:'DATAHUB_DISCOVERY_READY',catalogUrl:catalog,datasets:datasets.map(x=>({datasetKey:x[0],level:x[1]})),lgaWardAssertionsEnabled:false});}