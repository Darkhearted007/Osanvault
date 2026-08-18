import { db } from 'hatchable';

export const access = 'member';
export const methods = ['GET','POST'];

function clamp(n) { return Math.max(0, Math.min(100, Number(n) || 0)); }
function band(score) {
  if (score >= 80) return 'strong';
  if (score >= 60) return 'readying';
  if (score >= 40) return 'developing';
  return 'early';
}

export default async function(req, res) {
  const onboardingId = req.params.id;
  const { rows: owner } = await db.query(
    `SELECT id FROM economic_onboarding WHERE id = $1 LIMIT 1`, [onboardingId]
  );
  if (!owner.length) return res.status(404).json({ error: 'Economic onboarding record not found' });

  const { rows: evidence } = await db.query(
    `SELECT
       COUNT(*)::int AS total_evidence,
       COUNT(*) FILTER (WHERE COALESCE(status,'') IN ('verified','accepted','approved'))::int AS verified_evidence
     FROM economic_evidence WHERE onboarding_id = $1`, [onboardingId]
  );
  const { rows: activities } = await db.query(
    `SELECT COUNT(*)::int AS activity_count FROM economic_activities WHERE onboarding_id = $1`, [onboardingId]
  );
  const { rows: network } = await db.query(
    `SELECT COUNT(*)::int AS network_count FROM economic_network_relationships WHERE onboarding_id = $1`, [onboardingId]
  );

  const totalEvidence = Number(evidence[0]?.total_evidence || 0);
  const verifiedEvidence = Number(evidence[0]?.verified_evidence || 0);
  const evidenceCoverage = clamp(Math.min(100, totalEvidence * 20));
  const verificationStrength = totalEvidence ? clamp((verifiedEvidence / totalEvidence) * 100) : 0;
  const activityConsistency = clamp(Math.min(100, Number(activities[0]?.activity_count || 0) * 10));
  const networkStrength = clamp(Math.min(100, Number(network[0]?.network_count || 0) * 15));
  const documentationCompleteness = clamp((evidenceCoverage * 0.6) + (verificationStrength * 0.4));
  const score = clamp(
    evidenceCoverage * 0.25 +
    verificationStrength * 0.30 +
    activityConsistency * 0.15 +
    networkStrength * 0.10 +
    documentationCompleteness * 0.20
  );

  const gaps = [];
  if (evidenceCoverage < 70) gaps.push('Increase documented economic evidence');
  if (verificationStrength < 70) gaps.push('Obtain verification for key evidence');
  if (activityConsistency < 60) gaps.push('Build a stronger history of recorded economic activity');
  if (networkStrength < 50) gaps.push('Document more verified economic relationships');
  if (documentationCompleteness < 70) gaps.push('Complete supporting documentation');

  const factors = [
    { key: 'evidence_coverage', label: 'Evidence coverage', value: evidenceCoverage, weight: 25 },
    { key: 'verification_strength', label: 'Verification strength', value: verificationStrength, weight: 30 },
    { key: 'activity_consistency', label: 'Activity consistency', value: activityConsistency, weight: 15 },
    { key: 'network_strength', label: 'Economic network strength', value: networkStrength, weight: 10 },
    { key: 'documentation_completeness', label: 'Documentation completeness', value: documentationCompleteness, weight: 20 }
  ];

  const capitalFit = {
    suitable_for: score >= 70 ? ['working_capital_review','asset_finance_review','institutional_partnership_review'] : ['readiness_building','documentation_support'],
    restrictions: ['Not a credit score','Not an automated approval','Institutional underwriting and applicable policy still required']
  };

  const { rows } = await db.query(
    `INSERT INTO economic_capital_readiness
      (onboarding_id, readiness_score, readiness_band, evidence_coverage, verification_strength, activity_consistency, network_strength, documentation_completeness, capital_fit, gaps, factors, calculated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,now())
     ON CONFLICT (onboarding_id) DO UPDATE SET
       readiness_score=EXCLUDED.readiness_score,
       readiness_band=EXCLUDED.readiness_band,
       evidence_coverage=EXCLUDED.evidence_coverage,
       verification_strength=EXCLUDED.verification_strength,
       activity_consistency=EXCLUDED.activity_consistency,
       network_strength=EXCLUDED.network_strength,
       documentation_completeness=EXCLUDED.documentation_completeness,
       capital_fit=EXCLUDED.capital_fit,
       gaps=EXCLUDED.gaps,
       factors=EXCLUDED.factors,
       calculated_at=now()
     RETURNING *`,
    [onboardingId, score, band(score), evidenceCoverage, verificationStrength, activityConsistency, networkStrength, documentationCompleteness, capitalFit, JSON.stringify(gaps), JSON.stringify(factors)]
  );

  res.json({
    readiness: rows[0],
    principle: 'Evidence informs institutional review; the platform does not make an automated lending or investment decision.'
  });
}