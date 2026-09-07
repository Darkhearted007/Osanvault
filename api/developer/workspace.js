import { db } from 'hatchable';
export const access='member';
export const methods=['GET'];
const ROLES=new Set(['OWNER','ADMIN','DEVELOPER_ADMIN','PROJECT_MANAGER','FINANCE','COMPLIANCE','VIEWER']);
export default async function(req,res){
  const member=req.member;
  const orgs=await db.query(`SELECT o.id,o.name,o.slug,o.organization_type,o.status,m.role
    FROM gis_organizations o JOIN gis_organization_members m ON m.organization_id=o.id
    WHERE m.member_id=$1 AND m.status='ACTIVE' AND o.status='ACTIVE' ORDER BY o.created_at ASC`,[member.id]);
  if(!orgs.rows.length)return res.json({organization:null,organizations:[],projects:[],message:'No active organization workspace is available.'});
  const requested=String(req.query?.organization_id||'');
  const org=orgs.rows.find(x=>!requested||x.id===requested);
  if(!org)return res.status(403).json({error:'organization_access_denied'});
  const role=org.role||'USER';
  const projects=await db.query(`SELECT p.id,p.project_identifier AS "projectIdentifier",p.name,p.description,p.project_type AS "projectType",
    p.status,p.jurisdiction,p.location,p.development_stage AS "developmentStage",p.units,p.development_scope AS "developmentScope",
    p.estimated_completion AS "estimatedCompletion",p.submission_source AS "submissionSource",p.created_at AS "createdAt",
    COALESCE(cr.capital_requirement,0) AS "capitalRequirement",COALESCE(cr.currency,'NGN') AS currency,
    COALESCE(cr.readiness_state,'not_ready') AS "readinessState",
    COALESCE(cr.legal_ready,false) AS "legalReady",COALESCE(cr.evidence_ready,false) AS "evidenceReady",
    COALESCE(cr.valuation_ready,false) AS "valuationReady",COALESCE(cr.risk_ready,false) AS "riskReady",
    COALESCE(cr.economics_ready,false) AS "economicsReady",COALESCE(cr.governance_ready,false) AS "governanceReady"
    FROM projects p LEFT JOIN project_capital_readiness cr ON cr.project_id=p.id
    WHERE p.organization_id=$1 ORDER BY p.created_at DESC`,[org.id]);
  const ids=projects.rows.map(x=>x.id);
  const reqd=ids.length?await db.query(`SELECT project_id,COALESCE(SUM(amount),0) AS amount FROM project_capital_requests WHERE project_id=ANY($1::uuid[]) GROUP BY project_id`,[ids]):{rows:[]};
  const opp=ids.length?await db.query(`SELECT project_id,COUNT(*)::int AS count FROM capital_opportunities WHERE project_id=ANY($1::uuid[]) AND status IN ('diligence','open') GROUP BY project_id`,[ids]):{rows:[]};
  const evidence=ids.length?await db.query(`SELECT project_id,COUNT(*)::int AS count FROM project_evidence WHERE project_id=ANY($1::uuid[]) GROUP BY project_id`,[ids]).catch(()=>({rows:[]})):{rows:[]};
  const by=(rows,k)=>Object.fromEntries(rows.map(x=>[String(x.project_id),x[k]]));
  const capitalBy=by(reqd,'amount'),oppBy=by(opp,'count'),evBy=by(evidence,'count');
  const enriched=projects.rows.map(x=>({...x,capitalRequested:capitalBy[x.id]??null,activeOpportunities:Number(oppBy[x.id]||0),evidenceCount:Number(evBy[x.id]||0)}));
  const stats={
    projects:enriched.length,
    projectsRequiringAction:enriched.filter(x=>x.readinessState==='not_ready'||!x.legalReady||!x.evidenceReady||!x.economicsReady||!x.riskReady||!x.governanceReady).length,
    capitalRequested:enriched.reduce((n,x)=>n+(x.capitalRequested==null?0:Number(x.capitalRequested)),0),
    capitalReady:enriched.filter(x=>x.readinessState==='capital_ready'||x.readinessState==='capital_ready_candidate').length,
    activeDevelopments:enriched.filter(x=>['active','construction','development'].includes(String(x.developmentStage||'').toLowerCase())).length,
    activeOpportunities:enriched.reduce((n,x)=>n+x.activeOpportunities,0)
  };
  res.json({organization:{id:org.id,name:org.name,slug:org.slug||null,organizationType:org.organization_type,status:org.status,role},
    authorization:{authenticated:true,membership:true,role,roleRecognized:ROLES.has(role)},
    organizationVerification:{status:'organization_status',value:org.status,note:'Organization status is not a KYB certification.'},
    stats,projects:enriched,message:enriched.length?'Production project records only.':'No production projects yet.'});
}