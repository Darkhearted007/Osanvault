import { db } from "hatchable";
export const access="admin";
export const methods=["POST"];

export default async function(req,res){
  const job=(await db.query("SELECT fetch_offset,total_loaded,total_invalid,status,last_error FROM gis_phase383_ward_ingestion WHERE dataset_key='GRID3_WARD_V3' LIMIT 1")).rows[0];
  if(!job)return res.status(404).json({phase:384,status:"INGESTION_JOB_NOT_FOUND"});

  const src="https://services3.arcgis.com/BU6Aadhn6tbBEdyk/arcgis/rest/services/GRID3_NGA_operational_wards_v3_0/FeatureServer/0/query";
  const countUrl=new URL(src); countUrl.searchParams.set("where","1=1"); countUrl.searchParams.set("returnCountOnly","true"); countUrl.searchParams.set("f","json");
  const cr=await fetch(countUrl); const ct=await cr.text(); let cd; try{cd=JSON.parse(ct)}catch{cd={};}
  const sourceCount=Number(cd.count||0);

  const ds=(await db.query("SELECT id FROM gis_phase372_boundary_datasets WHERE dataset_key='GRID3_ADMIN_BOUNDARIES' LIMIT 1")).rows[0];
  if(!ds)return res.status(404).json({phase:384,status:"BOUNDARY_DATASET_NOT_FOUND"});

  const rows=(await db.query(`SELECT boundary_id,parent_id,name,state_code,geometry_geojson,geometry_valid,geometry_empty FROM gis_phase372_boundary_features WHERE dataset_id=$1 AND boundary_level='WARD'`,[ds.id])).rows;
  const stored=rows.length;
  const invalid=rows.filter(x=>!x.geometry_valid||x.geometry_empty||!x.geometry_geojson).length;
  const unique=new Set(rows.map(x=>String(x.boundary_id))).size;
  const duplicateGroups=stored-unique;

  const missing=Math.max(0,sourceCount-stored);
  const sourceComplete=sourceCount>0&&stored===sourceCount;
  const geometryComplete=invalid===0;
  const uniqueComplete=duplicateGroups===0;
  const ingestionComplete=String(job.status)==="COMPLETE"&&Number(job.total_invalid)===0;
  const ready=sourceComplete&&geometryComplete&&uniqueComplete&&ingestionComplete;

  await db.query(`CREATE TABLE IF NOT EXISTS gis_phase384_verification (id BIGSERIAL PRIMARY KEY, verified_at TIMESTAMPTZ NOT NULL DEFAULT now(), source_count BIGINT NOT NULL, stored_count BIGINT NOT NULL, missing_count BIGINT NOT NULL, invalid_geometry_count BIGINT NOT NULL, duplicate_count BIGINT NOT NULL, ingestion_complete BOOLEAN NOT NULL, source_complete BOOLEAN NOT NULL, geometry_complete BOOLEAN NOT NULL, ready_for_certification BOOLEAN NOT NULL)`);
  await db.query(`INSERT INTO gis_phase384_verification(source_count,stored_count,missing_count,invalid_geometry_count,duplicate_count,ingestion_complete,source_complete,geometry_complete,ready_for_certification) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,[sourceCount,stored,missing,invalid,duplicateGroups,ingestionComplete,sourceComplete,geometryComplete,ready]);

  return res.json({phase:384,status:ready?"CERTIFICATION_READY":"VERIFICATION_FAILED",verification:{sourceCount,storedCount:stored,missingCount:missing,invalidGeometryCount:invalid,duplicateGroups,ingestionComplete,sourceComplete,geometryComplete,readyForCertification:ready},next:ready?"Enable certification only after human approval":"Resolve verification failures before certification"});
}