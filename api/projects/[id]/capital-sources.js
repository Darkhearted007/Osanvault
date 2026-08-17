import { db } from 'hatchable';
export const access = 'public';
export const methods = ['GET'];

const norm=s=>String(s||'').toLowerCase();
const overlap=(text,items)=>items.filter(x=>norm(text).includes(norm(x.replaceAll('_',' ')))).length;
const state=s=>s>=75?'strong_fit':s>=55?'possible_fit':'weak_fit';

export default async function(req,res){
 const id=req.params.id;
 const [project,profile,sources]=await Promise.all([
  db.query('SELECT name,description,sector,location FROM projects WHERE id=$1',[id]),
  db.query('SELECT capital_readiness_score,development_stage,expected_cashflow,security_type,risk_profile,use_of_funds,revenue_model FROM canonical_capital_profiles WHERE project_id=$1',[id]),
  db.query(`SELECT i.id AS institution_id,i.organization_name AS institution_name,i.organization_type,i.website,i.mandate,csp.id AS source_profile_id,csp.capital_types,csp.sectors,csp.geographies,csp.minimum_readiness,csp.instrument_notes,csp.eligibility_notes,csp.evidence_urls FROM institutional_profiles i JOIN capital_source_profiles csp ON csp.institution_id=i.id WHERE i.status='active'`)
 ]);
 if(!project.rows.length)return res.status(404).json({error:'project_not_found'});
 const p=profile.rows[0]||{};
 const text=[project.rows[0].name,project.rows[0].description,project.rows[0].sector,project.rows[0].location,p.use_of_funds,p.revenue_model].join(' ');
 const readiness=Number(p.capital_readiness_score)||0;
 const matches=sources.rows.map(s=>{
  const sectors=Array.isArray(s.sectors)?s.sectors:[];
  const sectorHits=overlap(text,sectors);
  const geoHits=overlap(`${project.rows[0].location||''} Nigeria`,s.geographies||[]);
  const capitalFit=overlap(`${p.development_stage||''} ${p.use_of_funds||''}`,s.capital_types||[]);
  let score=Math.round(readiness*.45 + Math.min(100,sectorHits*22)*.25 + Math.min(100,geoHits*50)*.10 + Math.min(100,capitalFit*30)*.10 + (readiness>=s.minimum_readiness?10:0));
  score=Math.max(0,Math.min(100,score));
  const gaps=[];
  if(readiness<s.minimum_readiness)gaps.push(`Capital readiness is below the current screening threshold of ${s.minimum_readiness}.`);
  if(!sectorHits)gaps.push('No strong sector keyword alignment was detected from the current project profile.');
  if(!geoHits)gaps.push('Geographic eligibility should be verified before outreach.');
  const strengths=[];
  if(readiness>=s.minimum_readiness)strengths.push('Current capital readiness clears the source screening threshold.');
  if(sectorHits)strengths.push('Project sector signals align with the source profile.');
  if(geoHits)strengths.push('Project geography aligns with the source profile.');
  const actions=gaps.length?['Close the identified evidence/readiness gaps before institutional outreach.','Verify the current programme, eligibility rules and application route from the institution’s official source.']:['Prepare a source-specific financing brief and diligence evidence pack.','Verify current product availability and eligibility before outreach.'];
  const rationale=state(score)==='strong_fit'?`${s.institution_name} is a strong preliminary source match based on the current project profile and source mandate.`:state(score)==='possible_fit'?`${s.institution_name} is a plausible preliminary source match, but diligence or evidence gaps remain.`:`${s.institution_name} is not currently a strong preliminary match; improve project readiness or alignment before prioritising outreach.`;
  return {...s,fitScore:score,fitState:state(score),rationale,strengths,gaps,nextActions:actions};
 }).sort((a,b)=>b.fitScore-a.fitScore);
 for(const m of matches)await db.query(`INSERT INTO capital_source_matches(project_id,institution_id,source_profile_id,fit_score,fit_state,rationale,strengths,gaps,next_actions) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT(project_id,institution_id) DO UPDATE SET source_profile_id=EXCLUDED.source_profile_id,fit_score=EXCLUDED.fit_score,fit_state=EXCLUDED.fit_state,rationale=EXCLUDED.rationale,strengths=EXCLUDED.strengths,gaps=EXCLUDED.gaps,next_actions=EXCLUDED.next_actions,assessed_at=now()`,[id,m.institution_id,m.source_profile_id,m.fitScore,m.fitState,m.rationale,JSON.stringify(m.strengths),JSON.stringify(m.gaps),JSON.stringify(m.nextActions)]);
 res.json({projectId:id,sourceMatches:matches.map(m=>({institutionId:m.institution_id,institutionName:m.institution_name,organizationType:m.organization_type,website:m.website,fitScore:m.fitScore,fitState:m.fitState,rationale:m.rationale,strengths:m.strengths,gaps:m.gaps,nextActions:m.nextActions,instrumentNotes:m.instrument_notes,eligibilityNotes:m.eligibility_notes,evidenceUrls:m.evidence_urls})),disclaimer:'Source matching is an internal screening signal. It is not financing approval, investment advice, an eligibility determination, or a guarantee of funding.'});
}