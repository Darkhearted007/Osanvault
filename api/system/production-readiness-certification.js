import { db } from 'hatchable';
export const access='admin';
export const methods=['GET'];

const PASS='PASS';
const BLOCKED='BLOCKED';
const OPTIONAL='OPTIONAL';

async function probe(name,sql,params=[]){
  try{
    const r=await db.query(sql,params);
    return {name,status:PASS,details:r.rows[0]||{}};
  }catch(e){
    return {name,status:BLOCKED,details:{error:String(e?.message||e)}};
  }
}

export default async function(req,res){
  const o=(await db.query("SELECT id,name,slug,status,dashboard_mode FROM gis_organizations WHERE slug='osanvault-africa-production' LIMIT 1")).rows[0];
  if(!o)return res.status(409).json({
    phase:'NATI-CORE-1',
    certification:'CORE_PRODUCTION',
    decision:'NOT_READY',
    score:0,
    blockers:[{name:'tenant_baseline',details:'Production tenant is not provisioned'}]
  });

  const p=(await db.query("SELECT position_code,position_name,dashboard_key FROM gis_organization_positions WHERE organization_id=$1 ORDER BY position_code",[o.id])).rows;
  const d=(await db.query("SELECT dashboard_key,position_code,config FROM gis_organization_dashboards WHERE organization_id=$1 ORDER BY position_code",[o.id])).rows;
  const b=(await db.query("SELECT baseline_key,status,position_count,dashboard_count,gis_dataset_status,e2e_status,created_at,updated_at FROM production_certification_baseline WHERE baseline_key='osanvault-africa-production' LIMIT 1")).rows[0];

  const gisLayerStats=(await db.query(
    "SELECT COUNT(*)::int AS total_layers, COUNT(*) FILTER (WHERE status='Active' AND visibility='Public')::int AS public_layers, COUNT(*) FILTER (WHERE status='Active' AND visibility='Public' AND source_url IS NOT NULL AND authority_name IS NOT NULL AND verification_status IS NOT NULL AND sensitivity IS NOT NULL)::int AS public_layers_with_core_metadata FROM gis_layers"
  )).rows[0]||{};

  const gisFeatureStats=(await db.query(
    "SELECT COUNT(*)::int AS total_features, COUNT(*) FILTER (WHERE geometry_json IS NOT NULL AND geometry_valid=true)::int AS valid_geometries, COUNT(*) FILTER (WHERE geometry_json IS NOT NULL AND geometry_valid=false AND layer_id IN (SELECT id FROM gis_layers WHERE status='Active' AND visibility='Public'))::int AS invalid_public_geometries, COUNT(*) FILTER (WHERE geometry_status IS NULL OR geometry_status='')::int AS missing_geometry_status, COUNT(*) FILTER (WHERE provider IS NULL OR provider='')::int AS missing_provider FROM gis_spatial_features"
  )).rows[0]||{};

  const assetStats=(await db.query(
    "SELECT (SELECT COUNT(*)::int FROM assets) AS assets, (SELECT COUNT(*)::int FROM gis_organization_assets) AS organization_asset_links, (SELECT COUNT(*)::int FROM gis_organization_assets ga LEFT JOIN assets a ON a.id=ga.asset_id WHERE a.id IS NULL) AS orphan_asset_links, (SELECT COUNT(*)::int FROM gis_organization_assets ga JOIN assets a ON a.id=ga.asset_id WHERE ga.organization_id=$1) AS tenant_asset_links",
    [o.id]
  )).rows[0]||{};

  const securityStats=(await db.query(
    "SELECT (SELECT COUNT(*)::int FROM security_controls WHERE enabled=true) AS enabled_security_controls, (SELECT COUNT(*)::int FROM tenant_security_controls WHERE enabled=true) AS enabled_tenant_security_controls"
  )).rows[0]||{};

  const e2e=(await db.query("SELECT test_key,status,completed_at,cleanup_status FROM platform_e2e_test_runs ORDER BY completed_at DESC NULLS LAST LIMIT 1")).rows[0]||null;
  const recovery=(await db.query("SELECT test_key,status,failed_count,completed_at FROM platform_failure_recovery_runs ORDER BY completed_at DESC NULLS LAST LIMIT 1")).rows[0]||null;

  const coreChecks=[
    {id:'application_health',scope:'CORE',status:(await probe('db','SELECT 1 AS reachable')).status,details:{database:'reachable',api:'executing'}},
    {id:'authentication_authorization',scope:'CORE',status:Number(securityStats.enabled_security_controls||0)>0?PASS:BLOCKED,details:{enabled_security_controls:Number(securityStats.enabled_security_controls||0)}},
    {id:'tenant_isolation_controls',scope:'CORE',status:Number(securityStats.enabled_tenant_security_controls||0)>0?PASS:BLOCKED,details:{enabled_tenant_security_controls:Number(securityStats.enabled_tenant_security_controls||0)}},
    {id:'database_integrity',scope:'CORE',status:Number(assetStats.orphan_asset_links||0)===0?PASS:BLOCKED,details:{orphan_asset_links:Number(assetStats.orphan_asset_links||0)}},
    {id:'gis_infrastructure_health',scope:'CORE',status:Number(gisLayerStats.total_layers)>0&&Number(gisFeatureStats.invalid_public_geometries||0)===0?PASS:BLOCKED,details:{layers:Number(gisLayerStats.total_layers||0),features:Number(gisFeatureStats.total_features||0),valid_geometries:Number(gisFeatureStats.valid_geometries||0),invalid_public_geometries:Number(gisFeatureStats.invalid_public_geometries||0),inec_authoritative_geometry_not_required:true,non_public_reference_geometry_does_not_block_core:true}},
    {id:'asset_data_integrity',scope:'CORE',status:Number(assetStats.orphan_asset_links||0)===0?PASS:BLOCKED,details:{assets:Number(assetStats.assets||0),organization_asset_links:Number(assetStats.organization_asset_links||0),tenant_asset_links:Number(assetStats.tenant_asset_links||0),orphan_asset_links:Number(assetStats.orphan_asset_links||0),empty_asset_inventory_is_not_fabricated:true}},
    {id:'provenance_controls',scope:'CORE',status:Number(gisLayerStats.total_layers)>0&&Number(gisLayerStats.public_layers)===Number(gisLayerStats.public_layers_with_core_metadata)?PASS:BLOCKED,details:{public_layers:Number(gisLayerStats.public_layers||0),public_layers_with_core_metadata:Number(gisLayerStats.public_layers_with_core_metadata||0)}},
    {id:'security_controls',scope:'CORE',status:Number(securityStats.enabled_security_controls)>0&&Number(securityStats.enabled_tenant_security_controls)>0?PASS:BLOCKED,details:securityStats},
    {id:'operational_monitoring',scope:'CORE',status:e2e||recovery?PASS:BLOCKED,details:{latest_e2e:e2e,latest_recovery:recovery}},
    {id:'backup_recovery_readiness',scope:'CORE',status:recovery?.status==='passed'&&Number(recovery?.failed_count||0)===0?PASS:BLOCKED,details:recovery||{message:'No recovery evidence'}},
    {id:'production_e2e',scope:'CORE',status:e2e?.status==='passed'&&e2e?.cleanup_status!=='dirty'?PASS:BLOCKED,details:e2e||{message:'No E2E evidence'}}
  ];

  const electoralChecks=[
    {id:'inec_canonical_source',scope:'ELECTORAL_OPTIONAL',status:OPTIONAL,details:'Evaluated only by the Electoral Intelligence certification path.'},
    {id:'inec_authoritative_artifact',scope:'ELECTORAL_OPTIONAL',status:OPTIONAL,details:'Evaluated only by the Electoral Intelligence certification path.'},
    {id:'inec_polling_unit_evidence',scope:'ELECTORAL_OPTIONAL',status:OPTIONAL,details:'Evaluated only by the Electoral Intelligence certification path.'},
    {id:'inec_historical_crosswalk',scope:'ELECTORAL_OPTIONAL',status:OPTIONAL,details:'Evaluated only by the Electoral Intelligence certification path.'}
  ];

  const blockers=coreChecks.filter(x=>x.status===BLOCKED);
  const finalAudit=(await db.query("SELECT production_gate,security_status,tenant_isolation_status,evidence_integrity_status,gis_integrity_status,existing_engine_result,execution_timestamp FROM gis_phase39121_final_certification_audits ORDER BY execution_timestamp DESC LIMIT 1")).rows[0]||null;
  const canonicalCertificationGate=!!finalAudit && finalAudit.production_gate==='READY' && finalAudit.security_status==='PASS' && finalAudit.tenant_isolation_status==='PASS' && finalAudit.evidence_integrity_status==='PASS' && finalAudit.gis_integrity_status==='PASS';
  if(!canonicalCertificationGate) blockers.push({id:'canonical_certification_gate',scope:'CORE',status:BLOCKED,details:finalAudit?{production_gate:finalAudit.production_gate,security_status:finalAudit.security_status,tenant_isolation_status:finalAudit.tenant_isolation_status,evidence_integrity_status:finalAudit.evidence_integrity_status,gis_integrity_status:finalAudit.gis_integrity_status,execution_timestamp:finalAudit.execution_timestamp}: {message:'No canonical Phase 391.21 certification audit exists'}});
  const decision=blockers.length?'NOT_READY':'PRODUCTION_READY';
  const result={
    phase:'NATI-CORE-1',
    certification:'CORE_PRODUCTION',
    product:'ÒSÁNVAULT NATIONAL ASSET & TERRITORY INTELLIGENCE',
    decision,
    score:Math.round((coreChecks.filter(x=>x.status===PASS).length/coreChecks.length)*100),
    certification_scope:{
      core:'National asset, territory and spatial intelligence; INEC/electoral evidence is not a prerequisite.',
      electoral:'Optional governed integration for electoral intelligence.'
    },
    checks:[...coreChecks,...electoralChecks],
    blockers,
    baseline:b||null,
    core_gis_summary:{
      layers:Number(gisLayerStats.total_layers||0),
      public_layers:Number(gisLayerStats.public_layers||0),
      public_layers_with_core_metadata:Number(gisLayerStats.public_layers_with_core_metadata||0),
      total_features:Number(gisFeatureStats.total_features||0),
      valid_geometries:Number(gisFeatureStats.valid_geometries||0),
      invalid_geometries:Number(gisFeatureStats.invalid_geometries||0),
      missing_geometry_status:Number(gisFeatureStats.missing_geometry_status||0),
      missing_provider:Number(gisFeatureStats.missing_provider||0)
    },
    asset_summary:assetStats,
    position_summary:{count:p.length},
    dashboard_summary:{count:d.length},
    nextAction:blockers.length?'Resolve the remaining CORE blockers and rerun this certificate.':'Core production certification prerequisites are satisfied; run final security/E2E evidence review before release.',
    policy:'INEC is never substituted by third-party geometry, and electoral evidence remains governed by a separate optional certification scope. Security, provenance, tenant isolation and fail-closed behavior remain core requirements.',
    timestamp:new Date().toISOString()
  };
  res.status(decision==='PRODUCTION_READY'?200:409).json(result);
}