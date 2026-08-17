import { db, storage } from 'hatchable';
export const access = 'admin';
export const methods = ['GET','POST'];
async function sha256(buffer) { const digest = await crypto.subtle.digest('SHA-256', buffer); return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2,'0')).join(''); }
export default async function (req, res) {
  const assetId = req.params.id;
  if (req.method === 'GET') {
    const { rows } = await db.query('SELECT id, document_type AS "documentType", title, document_hash AS "documentHash", version, status, created_at AS "createdAt" FROM asset_documents WHERE asset_id = $1 ORDER BY created_at DESC', [assetId]);
    return res.json(rows);
  }
  const file = req.files?.find(f => f.field === 'file');
  const title = req.body?.title || file?.filename;
  const documentType = req.body?.documentType || 'supporting_document';
  if (!file || !title) return res.status(400).json({ error: 'file and title are required' });
  const hash = await sha256(file.buffer);
  const key = `assets/${assetId}/documents/${hash}-${file.filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const url = await storage.put(key, file.buffer, file.contentType || 'application/octet-stream');
  const doc = await db.query('INSERT INTO asset_documents (asset_id, document_type, title, storage_url, document_hash, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, document_type AS "documentType", title, document_hash AS "documentHash", status, created_at AS "createdAt"', [assetId, documentType, title, url, hash, 'received']);
  await db.query('INSERT INTO asset_evidence (asset_id, evidence_type, source, description, document_id, status) VALUES ($1, $2, $3, $4, $5, $6)', [assetId, 'document', 'ÒsánVault Evidence Vault', `Document uploaded: ${title}`, doc.rows[0].id, 'pending']);
  await db.query('INSERT INTO asset_events (asset_id, event_type, actor, payload) VALUES ($1, $2, $3, $4)', [assetId, 'document_uploaded', req.member?.handle || 'admin', JSON.stringify({ documentId: doc.rows[0].id, hash })]);
  res.status(201).json(doc.rows[0]);
}