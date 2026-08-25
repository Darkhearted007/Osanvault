import { db } from "hatchable";

export const access = "admin";
export const methods = ["POST"];

const GRID3_LGA = "https://services3.arcgis.com/BU6Aadhn6tbBEdyk/ArcGIS/rest/services/GRID3_Nigeria_Local_Government_Area_Boundaries_with_Names/FeatureServer";
const GRID3_CATALOG = "https://grid3.org/geospatial-data-nigeria";

export default async function(req,res){
  const version=req.body?.crosswalk_version||"phase323-current";
  const run=await db.query(`INSERT INTO gis_authoritative_acquisition_runs (crosswalk_version,provider,dataset_name,source_url,status) VALUES ($1,'GRID3','Nigeria Operational LGA Boundaries',$2,'STARTED') RETURNING id`,[version,GRID3_LGA]);
  const runId=run.rows[0].id;
  try {
    const url=GRID3_LGA+"/11/query?where=1%3D1&outFields=*&returnGeometry=true&outSR=4326&f=geojson";
    const r=await fetch(url);
    if(!r.ok) throw new Error(`GRID3 HTTP ${r.status}`);
    const data=await r.json();
    const features=Array.isArray(data.features)?data.features:[];
    const records=features.map(f=>{
      const p=f.properties||{};
      const id=String(p.OBJECTID??p.FID??p.LGA_CODE??p.LGA_ID??p.lga_code??p.lga_id??"");
      const name=p.LGA_NAME??p.LGA??p.lganame??p.lga_name??p.NAME??p.name??null;
      const state=p.STATE_CODE??p.STATE??p.state_code??p.state??null;
      const geom=f.geometry||null;
      return {id,name,state,geom,valid:!!geom,empty:!geom};
    }).filter(x=>x.id);

    const sourceRow=await db.query(`INSERT INTO gis_geometry_sources (provider,dataset_name,dataset_version,source_url,geometry_format,geometry_crs,feature_count,provenance,status,imported_at) VALUES ('GRID3','Nigeria Operational LGA Boundaries','current',$1,'GeoJSON','EPSG:4326',$2,'{"catalog":"https://grid3.org/geospatial-data-nigeria","release":"Operational LGA Boundaries"}'::jsonb,'IMPORTED',now()) ON CONFLICT(provider,dataset_name,dataset_version) DO UPDATE SET source_url=EXCLUDED.source_url,feature_count=EXCLUDED.feature_count,status='IMPORTED',imported_at=now() RETURNING id`,[GRID3_LGA,records.length]);
    const sourceId=sourceRow.rows[0].id;
    const payload=JSON.stringify(records);
    const bulk=await db.query(`INSERT INTO gis_geometry_features (source_id,provider,feature_id,feature_name,state_code,geometry_geojson,normalized_geometry_available,geometry_valid,geometry_empty,source_srid,normalized_srid,validation_metadata) SELECT $1,'GRID3',r.id,r.name,r.state,r.geom,true,r.valid,r.empty,'4326','4326','{"acquisition":"phase335","source":"GRID3 ArcGIS FeatureServer"}'::jsonb FROM jsonb_to_recordset($2::jsonb) AS r(id text,name text,state text,geom jsonb,valid boolean,empty boolean) ON CONFLICT(source_id,feature_id) DO UPDATE SET feature_name=EXCLUDED.feature_name,state_code=EXCLUDED.state_code,geometry_geojson=EXCLUDED.geometry_geojson,normalized_geometry_available=true,geometry_valid=EXCLUDED.geometry_valid,geometry_empty=EXCLUDED.geometry_empty,validation_metadata=EXCLUDED.validation_metadata`,[sourceId,payload]);
    const imported=bulk.rowCount;
    await db.query(`UPDATE gis_authoritative_acquisition_runs SET completed_at=now(),status='COMPLETED',features_examined=$1,features_imported=$2,notes=$3::jsonb WHERE id=$4`,[features.length,imported,JSON.stringify({catalog:GRID3_CATALOG,source:GRID3_LGA,layer:11}),runId]);
    return res.json({phase:335,run_id:runId,status:'COMPLETED',provider:'GRID3',dataset:'Nigeria Operational LGA Boundaries',features_examined:features.length,features_imported:imported,source:GRID3_LGA,catalog:GRID3_CATALOG});
  } catch(e){
    await db.query(`UPDATE gis_authoritative_acquisition_runs SET completed_at=now(),status='FAILED',error_count=1,notes=$1::jsonb WHERE id=$2`,[JSON.stringify({error:String(e)}),runId]);
    return res.status(502).json({phase:335,run_id:runId,status:'FAILED',error:String(e)});
  }
}