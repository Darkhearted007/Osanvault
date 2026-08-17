import { db } from 'hatchable';
export const access = 'admin';
export const methods = ['GET','POST'];
export default async function (req, res) {
  const assetId = req.params.id;
  if (req.method === 'GET') {
    const { rows } = await db.query(`SELECT e.id, e.evidence_type AS "evidenceType", e.source, e.description, e.confidence, e.status, e.created_at AS "createdAt", d.id AS "documentId", d.title AS "documentTitle", d.document_type AS "documentType", d.document_hash AS "documentHash" FROM asset_evidence e LEFT JOIN asset_documents d ON d.id = e.document_id WHERE e.asset_id = $1 ORDER BY e.created_at DESC`, [assetId]);
    return res.json(rows);
  }
  const b = req.body || {};
  if (!b.evidenceType || !b.description) return res.status(400).json({ error: 'evidenceType and description are required' });
  const evidence = await db.query('INSERT INTO asset_evidence (asset_id, evidence_type, source, description, confidence, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, evidence_type AS "evidenceType", status', [assetId, b.evidenceType, b.source || null, b.description, b.confidence ?? null, b.status || 'pending']);
  if (!evidence.rows.length) return res.status(404).json({ error: 'Asset not found' });
  await db.query('INSERT INTO asset_events (asset_id, event_type, actor, payload) VALUES ($1, $2, $3, $4)', [assetId, 'evidence_added', req.member?.handle || 'admin', JSON.stringify({ evidenceId: evidence.rows[0].id, evidenceType: b.evidenceType })]);
  res.status(201).json(evidence.rows[0]);
}