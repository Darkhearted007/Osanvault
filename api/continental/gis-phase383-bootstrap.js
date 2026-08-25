import { db } from "hatchable";
export const access="admin";
export const methods=["POST"];
export default async function(req,res){const source='https://services3.arcgis.com/BU6Aadhn6tbBEdyk/arcgis/rest/services/GRID3_NGA_operational_wards_v3_0/FeatureServer/0';await db.query(`INSERT INTO gis_phase383_ward_ingestion(dataset_key,source_url) VALUES('GRID3_WARD_V3',$1) ON CONFLICT(dataset_key) DO UPDATE SET source_url=EXCLUDED.source_url,status='PENDING',last_error=NULL,updated_at=now()`,[source]);return res.json({phase:383,status:'BOOTSTRAPPED',datasetKey:'GRID3_WARD_V3',pageSize:10,source});}