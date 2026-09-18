import { db } from 'hatchable';
export const access='admin';
export const methods=['GET'];
async function probe(name,sql,scope='CORE'){
  try{const r=await db.query(sql);return {name,scope,status:'PASS',blocking:scope==='CORE',details:r.rows[0]||{}};}
  catch(e){return {name,scope,status:scope==='CORE'?'BLOCKED':'OPTIONAL',blocking:scope==='CORE',details:{error:String(e?.message||e)}};}
}
export default async function(req,res){
  const checks=[];
  checks.push(await probe('database','SELECT 1 AS reachable'));
  checks.push(await probe('organizations','SELECT COUNT(*)::int AS organizations FROM gis_organizations'));
  checks.push(await probe('assets','SELECT COUNT(*)::int AS assets FROM assets'));
  checks.push(await probe('evidence','SELECT COUNT(*)::int AS evidence FROM economic_evidence_vault'));
  checks.push(await probe('audit','SELECT COUNT(*)::int AS audit_events FROM governance_audit_events'));
  checks.push(await probe('gis_layers','SELECT COUNT(*)::int AS layers FROM gis_layers'));
  checks.push(await probe('gis_feature_integrity',"SELECT COUNT(*)::int AS total_features,COUNT(*) FILTER (WHERE geometry_json IS NOT NULL AND geometry_valid=true)::int AS valid_geometry,COUNT(*) FILTER (WHERE geometry_json IS NOT NULL AND geometry_valid=false)::int AS invalid_geometry FROM gis_spatial_features"));
  checks.push(await probe('asset_tenant_integrity',"SELECT COUNT(*) FILTER (WHERE a.id IS NULL)::int AS orphan_links FROM gis_organization_assets oa LEFT JOIN assets a ON a.id=oa.asset_id"));
  checks.push(await probe('security_controls',"SELECT (SELECT COUNT(*)::int FROM security_controls WHERE enabled=true) AS security_controls,(SELECT COUNT(*)::int FROM tenant_security_controls WHERE enabled=true) AS tenant_security_controls"));
  checks.push(await probe('backup_recovery_evidence',"SELECT test_key,status,failed_count,completed_at FROM platform_failure_recovery_runs ORDER BY completed_at DESC NULLS LAST LIMIT 1"));
  checks.push(await probe('production_e2e_evidence',"SELECT test_key,status,completed_at,cleanup_status FROM platform_e2e_test_runs ORDER BY completed_at DESC NULLS LAST LIMIT 1"));
  const electoral=[
    await probe('canonical_inec_source',"SELECT COUNT(*)::int AS canonical_sources FROM gis_canonical_source_identity WHERE source_key='INEC-POLLING-UNIT-LOCATOR-2026'",'ELECTORAL_OPTIONAL'),
    await probe('inec_official_artifacts',"SELECT COUNT(*)::int AS hashed_artifacts FROM inec_official_artifacts WHERE canonical_source_key='INEC-POLLING-UNIT-LOCATOR-2026' AND sha256 IS NOT NULL",'ELECTORAL_OPTIONAL'),
    await probe('inec_historical_crosswalk',"SELECT COUNT(*)::int AS historical_records FROM gis_exception_candidate_matches WHERE source_lineage_status='HISTORICAL_IDENTITY_LOST'",'ELECTORAL_OPTIONAL')
  ];
  electoral.forEach(x=>{x.status='OPTIONAL';x.blocking=false;});
  const blockers=checks.filter(x=>x.scope==='CORE'&&x.status==='BLOCKED');
  const decision=blockers.length?'NOT_READY':'CONTROLLED_PILOT_READY';
  const result={phase:'NATI-CORE-1',certification_scope:'CORE_PRODUCTION',product:'ÒSÁNVAULT NATIONAL ASSET & TERRITORY INTELLIGENCE',decision,production_gate:decision==='CONTROLLED_PILOT_READY'?'READY':'NOT_READY',checks:[...checks,...electoral],blockers,optional_electoral_checks:electoral,policy:'INEC/electoral evidence is a separately governed optional integration. No third-party/reference geometry is promoted to INEC authority and no INEC evidence is required for core national asset and territory certification.',timestamp:new Date().toISOString()};
  const r=await db.query('INSERT INTO systemwide_readiness_audits(phase,decision,checks,blockers) VALUES($1,$2,$3,$4) RETURNING id',['NATI-CORE-1',decision,JSON.stringify(result.checks),JSON.stringify(blockers)]);
  res.status(200).json({runId:r.rows[0].id,...result});
}