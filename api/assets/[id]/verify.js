import { db } from 'hatchable';
import { authorizeAssetTenant } from 'lib/assetTenantAuthority.js';
import { tenantError } from '../../../lib/tenantAuthority.js';

export const access = 'admin';
export const methods = ['POST'];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DECISIONS = new Set(['approved', 'rejected', 'pending']);

function optionalText(value, field, maxLength) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || value.length > maxLength) {
    return { error: field + ' must be a string of at most ' + maxLength + ' characters' };
  }
  return value;
}

export default async function (req, res) {
  const id = req.params?.id;
  if (typeof id !== 'string' || !UUID_RE.test(id)) {
    return res.status(400).json({ error: 'A valid asset ID is required' });
  }

  const tenant = await authorizeAssetTenant(req, id, 'asset:verify');
  if (!tenant.allowed) return tenantError(res, tenant);

  const body = req.body || {};
  if (typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({ error: 'Request body must be a JSON object' });
  }

  const verificationLevel = body.verificationLevel === undefined ? 'basic' : body.verificationLevel;
  if (typeof verificationLevel !== 'string' || verificationLevel.trim().length === 0 || verificationLevel.length > 32) {
    return res.status(400).json({ error: 'verificationLevel must be a non-empty string of at most 32 characters' });
  }

  const actionType = body.actionType === undefined ? 'review' : body.actionType;
  if (typeof actionType !== 'string' || actionType.trim().length === 0 || actionType.length > 64) {
    return res.status(400).json({ error: 'actionType must be a non-empty string of at most 64 characters' });
  }

  const notes = optionalText(body.notes, 'notes', 5000);
  if (notes && typeof notes === 'object') return res.status(400).json(notes);
  const rationale = optionalText(body.rationale, 'rationale', 5000);
  if (rationale && typeof rationale === 'object') return res.status(400).json(rationale);

  const decision = body.decision === undefined ? null : body.decision;
  if (decision !== null && (typeof decision !== 'string' || !DECISIONS.has(decision))) {
    return res.status(400).json({ error: 'decision must be one of: approved, rejected, pending' });
  }

  const actor = req.member?.handle || 'admin';

  // One PostgreSQL statement keeps case creation, action logging, decision logging,
  // asset state changes, and case closure atomic. Locking the asset row serializes
  // concurrent verification requests for the same asset.
  const result = await db.query(`
    WITH asset_row AS MATERIALIZED (
      SELECT id FROM assets WHERE id = $1::uuid FOR UPDATE
    ),
    existing_case AS MATERIALIZED (
      SELECT vc.id
      FROM verification_cases vc
      JOIN asset_row a ON a.id = vc.asset_id
      WHERE vc.status = 'open'
      ORDER BY vc.opened_at DESC
      LIMIT 1
    ),
    created_case AS (
      INSERT INTO verification_cases (asset_id, verification_level, status, closed_at)
      SELECT
        a.id,
        $2::text,
        CASE WHEN $6::text IN ('approved', 'rejected') THEN 'closed' ELSE 'open' END,
        CASE WHEN $6::text IN ('approved', 'rejected') THEN now() ELSE NULL END
      FROM asset_row a
      WHERE NOT EXISTS (SELECT 1 FROM existing_case)
      RETURNING id
    ),
    case_row AS MATERIALIZED (
      SELECT id FROM existing_case
      UNION ALL
      SELECT id FROM created_case
      LIMIT 1
    ),
    action_insert AS (
      INSERT INTO verification_actions (case_id, action_type, actor, notes)
      SELECT c.id, $3::text, $4::text, $5::text
      FROM case_row c
      RETURNING case_id
    ),
    decision_insert AS (
      INSERT INTO verification_decisions (case_id, decision, rationale, reviewer)
      SELECT c.id, $6::text, $7::text, $4::text
      FROM case_row c
      WHERE $6::text IS NOT NULL
      RETURNING case_id
    ),
    asset_update AS (
      UPDATE assets a
      SET
        status = CASE $6::text
          WHEN 'approved' THEN 'verified'
          WHEN 'rejected' THEN 'rejected'
          ELSE 'under_review'
        END,
        current_state = CASE $6::text
          WHEN 'approved' THEN 'verified'
          WHEN 'rejected' THEN 'rejected'
          ELSE 'under_review'
        END,
        updated_at = now()
      WHERE a.id = $1::uuid
        AND $6::text IS NOT NULL
        AND EXISTS (SELECT 1 FROM case_row)
      RETURNING a.id
    ),
    case_close AS (
      UPDATE verification_cases vc
      SET status = 'closed', closed_at = now()
      WHERE vc.id IN (SELECT id FROM existing_case)
        AND $6::text IN ('approved', 'rejected')
      RETURNING vc.id
    )
    SELECT id FROM case_row
  `, [id, verificationLevel, actionType, actor, notes, decision, rationale]);

  if (!result.rows.length) return res.status(404).json({ error: 'Asset not found' });
  return res.json({ ok: true, verificationCaseId: result.rows[0].id });
}
