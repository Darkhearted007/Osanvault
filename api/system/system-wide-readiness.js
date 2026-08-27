import { db } from 'hatchable';
export const access='admin';
export const methods=['GET'];
async function probe(name,sql){try{const r=await db.query(sql);return {name,status:'PASS',details:r.rows[0]||{}};}catch(e){return {name,status:'BLOCKED',details:{error:String(e?.message||e)}};}}
export default async function(req,res){
 const checks=[];
 checks.push(await probe('database','SELECT 1 AS reachable'));
 checks.push(await probe('organizations','SELECT COUNT(*)::int AS organizations FROM gis_organizations'));
 checks.push(await probe('assets','SELECT COUNT(*)::int AS assets FROM assets'));
 checks.push(await probe('evidence','SELECT COUNT(*)::int AS evidence FROM economic_evidence_vault'));
 checks.push(await probe('audit','SELECT COUNT(*)::int AS audit_events FROM governance_audit_events'));
 checks.push(await probe('gis_layers','SELECT COUNT(*)::int AS layers FROM gis_layers'));
 checks.push(await probe('gis_candidates','SELECT COUNT(*)::int AS candidates FROM gis_exception_candidate_matches'));
 checks.push(await probe('inec_source','SELECT COUNT(*)::int AS canonical_sources FROM gis_canonical_source_identity WHERE source_key=\'INEC-POLLING-UNIT-LOCATOR-2026\''));
 checks.push(await probe('inec_artifacts','SELECT COUNT(*)::int AS acquired_hashed FROM inec_official_artifacts WHERE canonical_source_key=\'INEC-POLLING-UNIT-LOCATOR-2026\' AND sha256 IS NOT NULL'));
 const candidateCheck=checks.find(x=>x.name==='gis_candidates');
 const sourceCheck=checks.find(x=>x.name==='inec_source');
 const artifactCheck=checks.find(x=>x.name==='inec_artifacts');
 const blockers=[];
 if(candidateCheck?.status==='PASS'&&Number(candidateCheck.details.candidates)!==30) blockers.push({name:'candidate_preservation',details:candidateCheck.details});
 if(sourceCheck?.status!=='PASS'||Number(sourceCheck?.details.canonical_sources)!==1) blockers.push({name:'canonical_inec_source',details:sourceCheck?.details});
 if(artifactCheck?.status!=='PASS'||Number(artifactCheck?.details.acquired_hashed)===0) blockers.push({name:'official_inec_artifact_certification',details:artifactCheck?.details||{}});
 for(const c of checks) if(c.status==='BLOCKED') blockers.push({name:c.name,details:c.details});
 const decision=blockers.length?'NOT_READY':'CONTROLLED_PILOT_READY';
 const result={phase:'391',decision,checks,blockers,production_gate:'NOT_READY_UNTIL_ALL_EXTERNAL_AND_EVIDENCE_DEPENDENCIES_CERTIFIED',principle:'System-wide gate; never overrides subsystem evidence gates.',timestamp:new Date().toISOString()};
 const r=await db.query('INSERT INTO systemwide_readiness_audits(phase,decision,checks,blockers) VALUES($1,$2,$3,$4) RETURNING id',['391',decision,JSON.stringify(checks),JSON.stringify(blockers)]);
 res.status(200).json({runId:r.rows[0].id,...result});
}