import { db } from 'hatchable';
import { authorizeTenant, tenantError } from '../../../lib/tenantAuthority.js';
export const access = 'admin';
export const methods = ['POST'];
export default async function (req, res) {
  const id = req.params.id;
  const ownership=(await db.query("SELECT organization_id FROM gis_organization_assets WHERE asset_id=$1 LIMIT 1",[id])).rows[0];
  if(!ownership)return res.status(403).json({error:'asset_not_tenant_assigned'});
  const tenant=await authorizeTenant(req,ownership.organization_id,'asset:verify');
  if(!tenant.allowed)return tenantError(res,tenant);
  const body = req.body || {};
  const existing = await db.query('SELECT id FROM verification_cases WHERE asset_id = $1 AND status = $2 LIMIT 1', [id, 'open']);
  let caseId;
  if (existing.rows.length) {
    caseId = existing.rows[0].id;
  } else {
    const created = await db.query('INSERT INTO verification_cases (asset_id, verification_level) VALUES ($1, $2) RETURNING id', [id, body.verificationLevel || 'basic']);
    if (!created.rows.length) return res.status(404).json({ error: 'Asset not found' });
    caseId = created.rows[0].id;
  }
  await db.query('INSERT INTO verification_actions (case_id, action_type, actor, notes) VALUES ($1, $2, $3, $4)', [caseId, body.actionType || 'review', req.member?.handle || 'admin', body.notes || null]);
  if (body.decision) {
    await db.query('INSERT INTO verification_decisions (case_id, decision, rationale, reviewer) VALUES ($1, $2, $3, $4)', [caseId, body.decision, body.rationale || null, req.member?.handle || 'admin']);
    const nextStatus = body.decision === 'approved' ? 'verified' : body.decision === 'rejected' ? 'rejected' : 'under_review';
    await db.query('UPDATE assets SET status = $1, current_state = $2, updated_at = now() WHERE id = $3', [nextStatus, nextStatus, id]);
    if (body.decision !== 'pending') await db.query('UPDATE verification_cases SET status = $1, closed_at = now() WHERE id = $2', ['closed', caseId]);
  }
  res.json({ ok: true, verificationCaseId: caseId });
}