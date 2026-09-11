import { db } from 'hatchable';
export const access='admin'; export const methods=['GET'];
export default async function(req,res){
 const o=(await db.query("SELECT id,name,slug,status,dashboard_mode FROM gis_organizations WHERE slug='osanvault-africa-production' LIMIT 1")).rows[0];
 if(!o)return res.status(409).json({phase:'388.30',certification:'PRODUCTION_READINESS',decision:'NOT_READY',score:0,blockers:[{name:'tenant_baseline',details:'Production tenant is not provisioned'}]});
 const p=(await db.query("SELECT position_code,position_name,dashboard_key FROM gis_organization_positions WHERE organization_id=$1 ORDER BY position_code",[o.id])).rows;
 const d=(await db.query("SELECT dashboard_key,position_code,config FROM gis_organization_dashboards WHERE organization_id=$1 ORDER BY position_code",[o.id])).rows;
 const b=(await db.query("SELECT baseline_key,status,position_count,dashboard_count,gis_dataset_status,e2e_status,created_at,updated_at FROM production_certification_baseline WHERE baseline_key='osanvault-africa-production' LIMIT 1")).rows[0];
 const gisLoaded=b?.gis_dataset_status==='LOADED';
 const e2eRun=b?.e2e_status==='PASSED';
 const checks=[
  {name:'control_plane_state',status:o.status==='ACTIVE'?'PASS':'BLOCKED',details:{organization:o.slug,status:o.status}},
  {name:'positions',status:p.length>=5?'PASS':'BLOCKED',details:{count:p.length}},
  {name:'dashboards',status:d.length>=5?'PASS':'BLOCKED',details:{count:d.length}},
  {name:'gis_dataset',status:gisLoaded?'PASS':'BLOCKED',details:{status:b?.gis_dataset_status||'MISSING'}},
  {name:'e2e_validation',status:e2eRun?'PASS':'BLOCKED',details:{status:b?.e2e_status||'MISSING'}}
 ];
 const blockers=checks.filter(x=>x.status==='BLOCKED');
 const decision=blockers.length?'NOT_READY':'PRODUCTION_READY';
 const result={phase:'388.30',certification:'PRODUCTION_READINESS',decision,score:Math.round((checks.length-blockers.length)/checks.length*100),checks,blockers,productionDeclaration:decision==='PRODUCTION_READY'?'Certified for production release':'Not certified: resolve every BLOCKED gate before declaring production ready',nextAction:blockers.length?'Resolve every blocked baseline requirement and rerun certification.':'Proceed to controlled production launch.',timestamp:new Date().toISOString()};
 res.status(decision==='PRODUCTION_READY'?200:409).json(result);
}