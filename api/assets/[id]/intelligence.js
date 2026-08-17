import { db } from 'hatchable';
export const access = 'public';
export const methods = ['GET'];
export default async function (req, res) {
  const id = req.params.id;
  const asset = await db.query('SELECT a.id, a.asset_identifier AS "assetIdentifier", a.name, a.status, a.current_state AS "currentState", t.name AS "assetTypeName", a.jurisdiction_code AS jurisdiction FROM assets a JOIN asset_types t ON t.id = a.asset_type_id WHERE a.id = $1', [id]);
  if (!asset.rows.length) return res.status(404).json({ error: 'Asset not found' });
  const [readiness, verification, risk, valuation, latest] = await Promise.all([
    db.query('SELECT COUNT(*) FILTER (WHERE vr.required) AS required_count, COUNT(*) FILTER (WHERE vr.required AND vr.status = $2) AS complete_count FROM verification_requirements vr JOIN verification_cases vc ON vc.id = vr.case_id WHERE vc.asset_id = $1', [id, 'verified']),
    db.query('SELECT status, verification_level AS "verificationLevel" FROM verification_cases WHERE asset_id = $1 ORDER BY opened_at DESC LIMIT 1', [id]),
    db.query('SELECT overall_score AS "overallScore", risk_level AS "riskLevel" FROM asset_risk_assessments WHERE asset_id = $1 ORDER BY assessed_at DESC LIMIT 1', [id]),
    db.query('SELECT value, currency, confidence, valuation_date AS "valuationDate" FROM asset_valuations WHERE asset_id = $1 ORDER BY valuation_date DESC LIMIT 1', [id]),
    db.query('SELECT trust_score AS "trustScore", evidence_score AS "evidenceScore", verification_score AS "verificationScore", risk_score AS "riskScore", market_score AS "marketScore", project_readiness_score AS "projectReadinessScore", overall_score AS "overallScore", intelligence_state AS "intelligenceState", rationale, assessed_at AS "assessedAt" FROM asset_intelligence_assessments WHERE asset_id = $1 ORDER BY assessed_at DESC LIMIT 1', [id])
  ]);
  const reqCount = Number(readiness.rows[0]?.required_count || 0), completeCount = Number(readiness.rows[0]?.complete_count || 0);
  const evidenceScore = reqCount ? Math.round((completeCount / reqCount) * 100) : 0;
  res.json({ asset: asset.rows[0], evidence: { score: evidenceScore, required: reqCount, complete: completeCount }, verification: verification.rows[0] || null, risk: risk.rows[0] || null, valuation: valuation.rows[0] || null, assessment: latest.rows[0] || null });
}