import { db } from 'hatchable';
import { authorizeTenant, tenantError } from 'lib/tenantAuthority.js';
export const access='member';
export const methods=['GET'];

const norm=s=>String(s||'').toLowerCase();
const overlap=(text,items)=>items.filter(x=>norm(text).includes(norm(String(x).replaceAll('_',' ')))).length;
const state=s=>s>=75?'strong_fit':s>=55?'possible_fit':'weak_fit';

export default async function(req,res){
  const id=String(req.params?.id||'').trim();
  const project=await db.query('SELECT id,name,description,organization_id AS "organizationId" FROM projects WHERE id=$1',[id]);
  if(!project.rows.length)return res.status(404).json({error:'project_not_found'});
  if(!project.rows[0].organizationId)return res.status(403).json({error:'project_not_tenant_assigned'});
  const tenant=await authorizeTenant(req,project.rows[0].organizationId,'capital:read');
  if(!tenant.allowed)return tenantError(res,tenant);

  const [profile,sources]=await Promise.all([
    db.query('SELECT capital_readiness_score,development_stage,expected_cashflow,security_type,risk_profile,use_of_funds,revenue_model FROM canonical_capital_profiles WHERE project_id=$1',[id]),
    db.query("SELECT i.id AS institution_id,i.organization_name AS institution_name,i.organization_type,i.website,i.mandate,csp.id AS source_profile_id,csp.capital_types,csp.sectors,csp.geographies,csp.minimum_readiness,csp.instrument_notes,csp.eligibility_notes,csp.evidence_urls FROM institutional_profiles i JOIN capital_source_profiles csp ON csp.institution_id=i.id WHERE i.status='active'")
  ]);
  const p=profile.rows[0]||{};
  const text=[project.rows[0].name,project.rows[0].description,p.use_of_funds,p.revenue_model].filter(Boolean).join(' ');
  const readiness=Number(p.capital_readiness_score)||0;
  const matches=sources.rows.map(s=>{
    const sectorHits=overlap(text,Array.isArray(s.sectors)?s.sectors:[]);
    const geoHits=overlap('Nigeria',Array.isArray(s.geographies)?s.geographies:[]);
    const capitalFit=overlap(`${p.development_stage||''} ${p.use_of_funds||''}`,Array.isArray(s.capital_types)?s.capital_types:[]);
    let score=Math.round(readiness*.45+Math.min(100,sectorHits*22)*.25+Math.min(100,geoHits*50)*.10+Math.min(100,capitalFit*30)*.10+(readiness>=Number(s.minimum_readiness||0)?10:0));
    score=Math.max(0,Math.min(100,score));
    const gaps=[];
    if(readiness<Number(s.minimum_readiness||0))gaps.push('Capital readiness is below the current screening threshold.');
    if(!sectorHits)gaps.push('No strong sector keyword alignment was detected from the current project profile.');
    if(!geoHits)gaps.push('Geographic eligibility should be verified before outreach.');
    const strengths=[];
    if(readiness>=Number(s.minimum_readiness||0))strengths.push('Current capital readiness clears the source screening threshold.');
    if(sectorHits)strengths.push('Project profile signals align with the source sector mandate.');
    if(geoHits)strengths.push('Nigeria appears in the current source geography profile.');
    const actions=['Close identified evidence/readiness gaps before institutional outreach.','Verify the current programme, eligibility rules and application route from the institution official source.'];
    const rationale=state(score)==='strong_fit'?s.institution_name+' is a strong preliminary source match based on the current project profile and source mandate.':state(score)==='possible_fit'?s.institution_name+' is a plausible preliminary source match, but diligence or evidence gaps remain.':s.institution_name+' is not currently a strong preliminary match; improve project readiness or alignment before prioritising outreach.';
    return{...s,fitScore:score,fitState:state(score),rationale,strengths,gaps,nextActions:actions};
  }).sort((a,b)=>b.fitScore-a.fitScore);

  res.json({
    projectId:id,
    sourceMatches:matches.map(m=>({institutionId:m.institution_id,institutionName:m.institution_name,organizationType:m.organization_type,website:m.website,fitScore:m.fitScore,fitState:m.fitState,rationale:m.rationale,strengths:m.strengths,gaps:m.gaps,nextActions:m.nextActions,instrumentNotes:m.instrument_notes,eligibilityNotes:m.eligibility_notes,evidenceUrls:m.evidence_urls})),
    disclaimer:'Source matching is an internal screening signal. It is not financing approval, investment advice, an eligibility determination, or a guarantee of funding.'
  });
}