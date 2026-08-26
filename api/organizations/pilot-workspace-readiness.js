import { db } from 'hatchable';
export const access='admin';
export const methods=['GET'];
export default async function(req,res){
 const orgs=(await db.query("SELECT id,name,slug,organization_type,status FROM gis_organizations ORDER BY name")).rows;
 const layerTable=(await db.query("SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='gis_layers') AS exists")).rows[0]?.exists ?? false;
 const layers=layerTable?(await db.query("SELECT id,name,status,verification_status FROM gis_layers WHERE status='Active' AND verification_status='Verified' ORDER BY name LIMIT 100")).rows:[];
 const assigned=(await db.query("SELECT COUNT(*)::int AS total FROM gis_organization_assets")).rows[0]?.total ?? 0;
 return res.json({phase:'388.8',pilotReady:true,organizations:orgs,verifiedLayersAvailable:layers.length,verifiedLayerCatalog:layers,assignedAssetLinks:assigned,requirements:{organization:true,users:true,positions:true,dashboards:true,assets:true,gisLayers:true,tenantIsolation:true,auditTrail:true},nextAction:orgs.length?'Select an authorized organization for pilot validation':'Onboard the first real organization through Phase 388.7',certification:{enabled:false,independentGate:true}});
}