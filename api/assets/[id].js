import { db } from 'hatchable';
export const access = 'public';
export const methods = ['GET'];
export default async function (req, res) {
  const id = req.params.id;
  const asset = await db.query(`SELECT a.id, a.asset_identifier AS "assetIdentifier", a.name, a.description, a.status, a.current_state AS "currentState", a.jurisdiction_code AS jurisdiction, t.code AS "assetTypeId", t.name AS "assetTypeName", t.asset_class AS "assetClass", l.address AS location, l.latitude, l.longitude FROM assets a JOIN asset_types t ON t.id = a.asset_type_id LEFT JOIN asset_locations l ON l.asset_id = a.id AND l.is_primary = true WHERE a.id = $1`, [id]);
  if (!asset.rows.length) return res.status(404).json({ error: 'Asset not found' });
  const [documents, evidence, verification, projects, valuations, risks] = await Promise.all([
    db.query('SELECT id, document_type AS "documentType", title, document_hash AS "documentHash", status, created_at AS "createdAt" FROM asset_documents WHERE asset_id = $1 ORDER BY created_at DESC', [id]),
    db.query('SELECT id, evidence_type AS "evidenceType", source, description, confidence, status, created_at AS "createdAt" FROM asset_evidence WHERE asset_id = $1 ORDER BY created_at DESC', [id]),
    db.query('SELECT id, status, verification_level AS "verificationLevel", opened_at AS "openedAt", closed_at AS "closedAt" FROM verification_cases WHERE asset_id = $1 ORDER BY opened_at DESC', [id]),
    db.query('SELECT p.id, p.project_identifier AS "projectIdentifier", p.name, p.project_type AS "projectType", p.status FROM projects p JOIN project_assets pa ON pa.project_id = p.id WHERE pa.asset_id = $1', [id]),
    db.query('SELECT id, valuation_date AS "valuationDate", methodology, valuer, currency, value, confidence FROM asset_valuations WHERE asset_id = $1 ORDER BY valuation_date DESC', [id]),
    db.query('SELECT id, model, overall_score AS "overallScore", risk_level AS "riskLevel", factors, mitigations, assessed_at AS "assessedAt" FROM asset_risk_assessments WHERE asset_id = $1 ORDER BY assessed_at DESC', [id])
  ]);
  res.json({ ...asset.rows[0], documents: documents.rows, evidence: evidence.rows, verification: verification.rows, projects: projects.rows, valuations: valuations.rows, risks: risks.rows });
}