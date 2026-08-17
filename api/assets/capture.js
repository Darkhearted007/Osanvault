import { db } from 'hatchable';
export const access = 'admin';
export const methods = ['POST'];
export default async function (req, res) {
  const b = req.body || {};
  if (!b.name || !b.assetTypeCode) return res.status(400).json({ error: 'name and assetTypeCode are required' });
  const type = await db.query('SELECT id FROM asset_types WHERE code = $1 AND active = true', [b.assetTypeCode]);
  if (!type.rows.length) return res.status(400).json({ error: 'Unknown asset type' });
  const identifier = b.assetIdentifier || `OVA-${String(b.jurisdictionCode || 'AF').toUpperCase()}-${Date.now()}`;
  const asset = await db.query('INSERT INTO assets (asset_identifier, asset_type_id, name, description, status, jurisdiction_code, current_state) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, asset_identifier AS "assetIdentifier"', [identifier, type.rows[0].id, b.name, b.description || null, 'captured', b.jurisdictionCode || null, 'captured']);
  if (b.location || b.latitude != null || b.longitude != null) await db.query('INSERT INTO asset_locations (asset_id, address, latitude, longitude, is_primary) VALUES ($1, $2, $3, $4, true)', [asset.rows[0].id, b.location || null, b.latitude ?? null, b.longitude ?? null]);
  const verification = await db.query('INSERT INTO verification_cases (asset_id, verification_level) VALUES ($1, $2) RETURNING id', [asset.rows[0].id, 'basic']);
  res.status(201).json({ ...asset.rows[0], verificationCaseId: verification.rows[0].id });
}