import { db } from 'hatchable';
export const access = 'member';
export const methods = ['GET'];

export default async function(req, res) {
  const type = req.query?.type;
  const id = req.query?.id;
  if (!type || !id) return res.status(400).json({ error: 'type and id are required' });
  if (!['asset','entity','project','institution'].includes(type)) return res.status(400).json({ error: 'Unsupported subject type' });

  const rel = await db.query(`SELECT status, confidence, relationship_type FROM economic_graph_relationships WHERE (from_type=$1 AND from_id=$2) OR (to_type=$1 AND to_id=$2)`, [type, id]);
  const trusted = rel.rows.filter(r => ['verified','trusted'].includes(r.status));
  const networkScore = rel.rows.length ? Math.round((trusted.length / rel.rows.length) * 100) : 20;

  let evidenceScore = 20, verificationScore = 20, economicScore = 20, capitalScore = 20;
  const strengths = [], risks = [], opportunities = [], missingEvidence = [], nextActions = [];

  if (type === 'asset') {
    const ev = await db.query(`SELECT COUNT(*)::int AS count, AVG(confidence) AS confidence FROM asset_evidence WHERE asset_id=$1`, [id]);
    const ver = await db.query(`SELECT COUNT(*)::int AS count FROM verification_cases WHERE asset_id=$1 AND status='closed'`, [id]);
    const rd = await db.query(`SELECT overall_score, project_readiness_score FROM asset_intelligence_assessments WHERE asset_id=$1 ORDER BY assessed_at DESC LIMIT 1`, [id]);
    evidenceScore = Math.min(100, (ev.rows[0]?.count || 0) * 20);
    verificationScore = ver.rows[0]?.count ? 80 : 20;
    capitalScore = rd.rows[0]?.project_readiness_score != null ? Number(rd.rows[0].project_readiness_score) : 20;
    if (ev.rows[0]?.count) strengths.push(`${ev.rows[0].count} evidence record(s) are attached`); else { risks.push('No asset evidence is currently attached'); missingEvidence.push('asset evidence'); nextActions.push('Attach primary asset evidence'); }
    if (ver.rows[0]?.count) strengths.push('A closed verification case exists'); else { risks.push('Verification has not reached a closed decision'); missingEvidence.push('closed verification decision'); nextActions.push('Complete asset verification'); }
  } else if (type === 'entity') {
    const cf = await db.query(`SELECT COUNT(*)::int AS count FROM economic_cashflow_records WHERE entity_id=$1`, [id]);
    const claims = await db.query(`SELECT COUNT(*)::int AS count, AVG(confidence) AS confidence FROM economic_claims WHERE entity_id=$1`, [id]);
    const rd = await db.query(`SELECT overall_score FROM economic_activity_assessments WHERE entity_id=$1 ORDER BY created_at DESC LIMIT 1`, [id]);
    economicScore = rd.rows[0]?.overall_score != null ? Number(rd.rows[0].overall_score) : Math.min(100, (cf.rows[0]?.count || 0) * 15);
    evidenceScore = claims.rows[0]?.count ? Math.min(100, Number(claims.rows[0].confidence || 0)) : 20;
    if (cf.rows[0]?.count) strengths.push(`${cf.rows[0].count} cash-flow record(s) are available`); else { risks.push('No cash-flow records are currently available'); missingEvidence.push('cash-flow evidence'); nextActions.push('Capture operating cash-flow evidence'); }
    if (claims.rows[0]?.count) strengths.push(`${claims.rows[0].count} economic claim(s) have provenance records`); else { missingEvidence.push('economic claims with supporting evidence'); nextActions.push('Document key economic claims and sources'); }
  } else if (type === 'project') {
    const rd = await db.query(`SELECT legal_ready,evidence_ready,valuation_ready,risk_ready,economics_ready,governance_ready,readiness_state FROM project_capital_readiness WHERE project_id=$1 ORDER BY assessed_at DESC LIMIT 1`, [id]);
    if (rd.rows[0]) {
      const flags = ['legal_ready','evidence_ready','valuation_ready','risk_ready','economics_ready','governance_ready'];
      capitalScore = Math.round(flags.reduce((sum, key) => sum + (rd.rows[0][key] ? 1 : 0), 0) / flags.length * 100);
      if (capitalScore >= 70) strengths.push(`Project capital-readiness is ${capitalScore}%`);
    } else { risks.push('Project readiness has not been assessed'); missingEvidence.push('project readiness assessment'); nextActions.push('Run project readiness assessment'); }
  } else {
    strengths.push('Institutional subject is available for network analysis');
    nextActions.push('Connect institutional mandate and diligence relationships');
  }

  if (trusted.length) strengths.push(`${trusted.length} trusted relationship(s) connect this subject to the economic graph`);
  else { risks.push('No trusted graph relationships are currently recorded'); nextActions.push('Verify key economic relationships'); }
  if (networkScore < 50) risks.push('Network confidence is currently limited');
  if (capitalScore >= 70) opportunities.push('Candidate for deeper institutional diligence');
  if (evidenceScore >= 70 && verificationScore >= 70) opportunities.push('Strong foundation for an Asset Passport or institutional data room');
  if (!opportunities.length) opportunities.push('Improve evidence and verification before capital engagement');

  const overallScore = Math.round((evidenceScore + verificationScore + economicScore + networkScore + capitalScore) / 5);
  const state = overallScore >= 80 ? 'capital_ready_candidate' : overallScore >= 60 ? 'diligence_ready_candidate' : overallScore >= 35 ? 'developing' : 'insufficient_data';
  const summary = `Cross-domain intelligence score is ${overallScore}/100. The current state is ${state}; conclusions are limited to recorded evidence, verification, economic records and graph relationships.`;
  res.json({ subjectType: type, subjectId: id, state, overallScore, scores: { evidenceScore, verificationScore, economicScore, networkScore, capitalReadinessScore: capitalScore }, summary, strengths, risks, opportunities, missingEvidence, nextActions, relationshipCount: rel.rows.length, trustedRelationshipCount: trusted.length, modelVersion: 'OV-15-RULES-V2' });
}