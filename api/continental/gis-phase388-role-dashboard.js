import { db } from 'hatchable';
export const access='member';
export const methods=['GET'];

const labels={executive:'Executive Command',operations:'Operations Control',analyst:'Intelligence Analyst',regulator:'Regulatory Oversight',investor:'Investment Intelligence'};
const allowed=new Set(Object.keys(labels));

export default async function(req,res){
 const member=req.member;
 const orgId=req.query?.organization_id;
 const requested=(req.query?.dashboard||'').toLowerCase();
 if(!orgId||!requested||!allowed.has(requested)) return res.status(400).json({error:'organization_id and valid dashboard are required'});
 const org=(await db.query("SELECT o.id,o.name,o.organization_type,m.role FROM gis_organization_memberships m JOIN gis_organizations o ON o.id=m.organization_id WHERE o.id=$1 AND m.member_id=$2 AND m.status='ACTIVE'",[orgId,member.id])).rows[0];
 if(!org)return res.status(404).json({error:'workspace_not_found'});
 const pos=(await db.query("SELECT id,title,dashboard_key FROM gis_organization_positions WHERE organization_id=$1 AND dashboard_key=$2 ORDER BY title",[orgId,requested])).rows;
 const assets=(await db.query("SELECT COUNT(*)::int total FROM gis_organization_assets WHERE organization_id=$1",[orgId])).rows[0].total;
 const alerts=(await db.query("SELECT COUNT(*)::int total FROM gis_organization_alerts WHERE organization_id=$1 AND status IN ('OPEN','ACTIVE','UNREAD')",[orgId])).rows[0].total;
 const critical=(await db.query("SELECT COUNT(*)::int total FROM gis_organization_alerts WHERE organization_id=$1 AND severity IN ('CRITICAL','HIGH') AND status IN ('OPEN','ACTIVE','UNREAD')",[orgId])).rows[0].total;
 const recs=(await db.query("SELECT COUNT(*)::int total FROM gis_organization_recommendations WHERE organization_id=$1 AND status IN ('OPEN','ACTIVE')",[orgId])).rows[0].total;
 const modules={
  overview:{kpi:'Authorized assets',value:assets,detail:'Assets visible to this organization'},
  assets:{kpi:'Asset portfolio',value:assets,detail:'Tenant-authorized asset inventory'},
  risk:{kpi:'Critical risk signals',value:critical,detail:'High/critical active signals'},
  alerts:{kpi:'Active alerts',value:alerts,detail:'Open or unread organization alerts'},
  gis:{kpi:'GIS intelligence',value:'LIVE',detail:'Authorized GIS context'},
  reports:{kpi:'Open recommendations',value:recs,detail:'Actionable recommendations'}
 };
 if(requested==='executive') modules.strategic={kpi:'Strategic posture',value:critical?'ATTENTION':'STABLE',detail:'Derived from active critical/high signals'};
 if(requested==='operations') modules.actions={kpi:'Priority actions',value:alerts+recs,detail:'Alerts plus open recommendations'};
 if(requested==='analyst') modules.evidence={kpi:'Evidence workspace',value:'READY',detail:'Tenant-scoped evidence exploration'};
 if(requested==='regulator') modules.compliance={kpi:'Compliance workspace',value:'READY',detail:'Authorized compliance and audit context'};
 if(requested==='investor') modules.portfolio={kpi:'Portfolio posture',value:assets?'ACTIVE':'EMPTY',detail:'Based on authorized asset coverage'};
 res.json({phase:388.4,organization:org,dashboard:{key:requested,label:labels[requested],positions:pos,modules},tenantIsolation:true,dataMode:assets?'LIVE':'ZERO_STATE',certification:{enabled:false}});
}