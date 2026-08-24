import { db } from "hatchable";

export const access = "admin";
export const methods = ["POST"];

function queryUrl(serviceUrl, offset) {
  return `${serviceUrl}/query?where=1%3D1&outFields=*&returnGeometry=true&outSR=4326&f=geojson&resultOffset=${offset}&resultRecordCount=200`;
}

export default async function (req, res) {
  const b = req.body || {};
  if (!b.source_id || !b.service_url) return res.status(400).json({ error: "source_id and service_url are required" });
  const source = await db.query(`SELECT id, provider, dataset_name FROM gis_geometry_sources WHERE id=$1`, [b.source_id]);
  if (!source.rows.length) return res.status(404).json({ error: "geometry source not found" });

  const run = await db.query(`INSERT INTO gis_import_runs(dataset_id,run_type,status,source_url,summary) VALUES(NULL,'PHASE328_AUTHORITATIVE_GEOMETRY','RUNNING',$1,$2) RETURNING id`, [b.service_url, `Phase 328 import for ${source.rows[0].dataset_name}`]);
  const runId = run.rows[0].id;
  let offset = 0;
  let imported = 0;
  try {
    while (true) {
      const response = await fetch(queryUrl(b.service_url, offset));
      if (!response.ok) throw new Error(`source returned HTTP ${response.status}`);
      const data = await response.json();
      const features = data.features || [];
      if (!features.length) break;
      const batch = features.map(f => ({
        provider: source.rows[0].provider,
        feature_id: String(f.id ?? f.properties?.FID ?? f.properties?.OBJECTID),
        feature_name: f.properties?.lganame ?? f.properties?.statename ?? f.properties?.name ?? null,
        state_code: f.properties?.statecode ?? null,
        geometry_geojson: f.geometry,
        normalized_geometry_available: !!f.geometry,
        geometry_valid: !!f.geometry,
        source_srid: '4326',
        normalized_srid: '4326',
        validation_metadata: { source_properties: f.properties, import_run_id: runId }
      }));
      const result = await db.query(`INSERT INTO gis_geometry_features(source_id,provider,feature_id,feature_name,state_code,geometry_geojson,normalized_geometry_available,geometry_valid,geometry_empty,source_srid,normalized_srid,validation_metadata) SELECT $1,provider,feature_id,feature_name,state_code,geometry_geojson::jsonb,normalized_geometry_available,geometry_valid,false,source_srid,normalized_srid,validation_metadata::jsonb FROM jsonb_to_recordset($2::jsonb) AS x(provider text,feature_id text,feature_name text,state_code text,geometry_geojson json,normalized_geometry_available boolean,geometry_valid boolean,source_srid text,normalized_srid text,validation_metadata json) ON CONFLICT(source_id,feature_id) DO UPDATE SET feature_name=EXCLUDED.feature_name,state_code=EXCLUDED.state_code,geometry_geojson=EXCLUDED.geometry_geojson,normalized_geometry_available=EXCLUDED.normalized_geometry_available,geometry_valid=EXCLUDED.geometry_valid,validation_metadata=EXCLUDED.validation_metadata`, [b.source_id, JSON.stringify(batch)]);
      imported += result.rowCount;
      offset += features.length;
      if (features.length < 200) break;
    }
    await db.query(`UPDATE gis_geometry_sources SET status='IMPORTED', feature_count=$1, imported_at=now() WHERE id=$2`, [imported, b.source_id]);
    await db.query(`UPDATE gis_import_runs SET status='COMPLETED',completed_at=now(),imported_features=$1,valid_features=$1,summary=$2 WHERE id=$3`, [imported, `Imported ${imported} authoritative GRID3 geometry features`, runId]);
    return res.json({ run_id: runId, source_id: b.source_id, imported_count: imported, status: 'COMPLETED' });
  } catch (error) {
    await db.query(`UPDATE gis_import_runs SET status='FAILED',completed_at=now(),imported_features=$1,summary=$2 WHERE id=$3`, [imported, String(error.message || error), runId]);
    return res.status(502).json({ run_id: runId, imported_count: imported, status: 'FAILED', error: String(error.message || error) });
  }
}