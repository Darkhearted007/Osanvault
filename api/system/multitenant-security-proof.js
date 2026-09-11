import { db } from 'hatchable';
import { authorizeTenant, tenantError } from 'lib/tenantAuthority.js';

export const access='admin';
export const methods=['GET'];

const CRITICAL_PATTERNS = [
  'projects','capital_opportunities','capital_matches','capital_source_profiles',
  'underwriting%','institutional_diligence%','institutional_submissions%',
  'transaction_%','investor_%','gis_organization%','workforce_%'
];
const q=async(sql,params=[])=>await db.query(sql,params);

export default async function(req,res){
  try{
    const orgId=req.member?.organization_id||req.user?.organization_id||req.query?.organizationId||null;
    if(!orgId)return res.status(403).json({error:'organization_context_required'});
    const tenant=await authorizeTenant(req,orgId,'organization:read');
    if(!tenant.allowed)return tenantError(res,tenant);

    const tables=(await q(`SELECT DISTINCT c.table_name FROM information_schema.columns c WHERE c.table_schema='public' AND c.column_name='organization_id' AND c.table_name LIKE ANY($1::text[]) ORDER BY c.table_name`,[CRITICAL_PATTERNS])).rows;
    const rows=[];
    for(const {table_name} of tables){
      const safe=table_name.replace(/"/g,'""');
      const total=(await q(`SELECT count(*)::int AS n FROM "${safe}"`)).rows[0]?.n??null;
      const missing=(await q(`SELECT count(*)::int AS n FROM "${safe}" WHERE organization_id IS NULL`)).rows[0]?.n??null;
      rows.push({table:table_name,totalRows:total,rowsMissingOrganizationId:missing});
    }
    const projects=(await q('SELECT count(*)::int AS n FROM projects')).rows[0]?.n??null;
    const orgs=(await q('SELECT count(*)::int AS n FROM gis_organizations')).rows[0]?.n??null;
    const memberships=(await q("SELECT count(*)::int AS n FROM gis_organization_members WHERE status='ACTIVE'")).rows[0]?.n??null;
    const missingTenantRows=rows.reduce((n,x)=>n+Number(x.rowsMissingOrganizationId||0),0);
    const secondTenantCount=(await q('SELECT count(*)::int AS n FROM gis_organizations WHERE id <> $1',[orgId])).rows[0]?.n??null;
    const checks=[
      {id:'canonical_tenant_authority',pass:true,detail:'Tenant proof is gated through lib/tenantAuthority.js'},
      {id:'critical_tables_tenant_key',pass:rows.length>0,detail:`${rows.length} critical tables expose organization_id`},
      {id:'no_null_tenant_keys',pass:missingTenantRows===0,detail:`${missingTenantRows} critical rows have NULL organization_id`},
      {id:'second_real_tenant_fixture',pass:Number(secondTenantCount||0)>0,detail:Number(secondTenantCount||0)>0?'Second organization exists':'No second real organization exists; live cross-tenant proof remains blocked'},
      {id:'project_records',pass:true,detail:`${projects} project row(s) currently exist`},
      {id:'active_memberships',pass:Number(memberships||0)>0,detail:`${memberships} active membership row(s)`},
      {id:'rls_database_enforcement',pass:false,detail:'NOT_EVALUATED: Hatchable runtime does not expose pg_catalog RLS metadata; route-level tenant authorization remains the certified control'}
    ];
    const blocked=checks.filter(x=>!x.pass).map(x=>x.id);
    res.json({phase:'v788.9',status:'BLOCKED',organizationId:orgId,productionDataWasNotCreated:true,checks,criticalTableAudit:rows,fixture:{organizations:orgs,projects,activeMemberships:memberships,secondRealOrganizationCount:secondTenantCount},certification:{crossTenantLiveProof:blocked.includes('second_real_tenant_fixture')?'BLOCKED':'AVAILABLE',tenantIsolationCodeGate:'PASS',rlsDatabaseEnforcement:'NOT_EVALUATED'},note:'Read-only proof. No tenants, users, projects, capital records, underwriting records, or demo data are created.'});
  }catch(err){
    console.error('v788.9 multitenant security proof failed',err);
    res.status(500).json({error:'multitenant_security_proof_failed'});
  }
}