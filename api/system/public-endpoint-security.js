import { storage } from 'hatchable';
export const access='admin';
export const methods=['GET'];
const routes=[
 ['/api/health','PUBLIC','health check; no tenant data'],
 ['/api/system/healthz','PUBLIC','health check; no tenant data'],
 ['/api/system/ip-protection','PUBLIC','IP notice/registry; no tenant data'],
 ['/api/institutions','PUBLIC','public institution reference data'],
 ['/api/taxonomy','PUBLIC','public taxonomy/reference data'],
 ['/api/public/asset-verification','PUBLIC','public verification-safe data only'],
 ['/api/public/asset-verification/history','PUBLIC','public verification-safe history only'],
 ['/api/gis/layers/public','PUBLIC','explicit public GIS layer only'],
 ['/api/gis/collections','PUBLIC','public GIS metadata only'],
 ['/api/gis/conformance','PUBLIC','public GIS conformance metadata'],
 ['/api/gis/features','PUBLIC','only public asset geometries and public or low-sensitivity layer metadata'],
 ['/api/gis/geojson','PUBLIC','only explicitly published public GIS layers'],
 ['/api/gis/asset/:assetId','PUBLIC','only asset geometries explicitly marked Public'],
 ['/api/cac/directors/document','TOKEN','invitation/document flow; token-bound only'],
 ['/api/cac/directors/invite','TOKEN','invitation flow; token-bound only'],
 ['/api/cac/directors/respond','TOKEN','invitation response; token-bound only']
];
export default async function(req,res){
 const payload={schema_version:1,phase:'388.33',updated_at:new Date().toISOString(),policy:'default-deny for tenant, intelligence, evidence, audit, administration and private GIS data; only explicitly listed routes may be public or token-bound',routes};
 await storage.put('security/public-endpoint-manifest.json',new TextEncoder().encode(JSON.stringify(payload)),'application/json');
 res.json(payload);
}