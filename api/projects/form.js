import { db } from 'hatchable';
export const access = 'admin';
export const methods = ['POST'];
export default async function (req, res) {
  const b = req.body || {};
  if (!b.assetId || !b.projectName || !b.projectType) return res.status(400).json({ error: 'assetId, projectName and projectType are required' });
  const asset = await db.query('SELECT id, name FROM assets WHERE id = $1', [b.assetId]);
  if (!asset.rows.length) return res.status(404).json({ error: 'Asset not found' });
  const readiness = await db.query('SELECT overall_score AS score FROM asset_intelligence_assessments WHERE asset_id = $1 ORDER BY assessed_at DESC LIMIT 1', [b.assetId]);
  const score = Number(readiness.rows[0]?.score || 0);
  if (score < 35) return res.status(409).json({ error: 'Asset is not sufficiently assessed for project formation', readinessScore: score });
  const row = await db.query('INSERT INTO project_formations (asset_id, opportunity_assessment_id, project_name, project_type, formation_stage, legal_structure, target_capital, currency, readiness_score, status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id, project_name AS "projectName", formation_stage AS "formationStage", readiness_score AS "readinessScore", status', [b.assetId,b.opportunityAssessmentId || null,b.projectName,b.projectType,'opportunity',b.legalStructure || null,b.targetCapital ?? null,b.currency || 'NGN',score,'draft']);
  res.status(201).json(row.rows[0]);
}