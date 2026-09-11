import { db } from 'hatchable';
import { authorizeTenant, tenantError } from '../../../lib/tenantAuthority.js';
export const access = 'member';
export const methods = ['GET'];
const weights = { OWNERSHIP: 30, LOCATION: 20, JURISDICTION: 20, LEGAL: 30 };
export default async function (req, res) {
  const id = req.params.id;
  const ownership=(await db.query("SELECT organization_id FROM gis_organization_assets WHERE asset_id=$1 LIMIT 1",[id])).rows[0];
  if(!ownership)return res.status(403).json({error:'asset_not_tenant_assigned'});
  const tenant=await authorizeTenant(req,ownership.organization_id,'asset:read');
  if(!tenant.allowed)return tenantError(res,tenant);
  const asset = await db.query('SELECT id, asset_identifier AS "assetIdentifier", name, status FROM assets WHERE id = $1', [id]);
  if (!asset.rows.length) return res.status(404).json({ error: 'Asset not found' });
  const reqs = await db.query('SELECT requirement_code AS code, title, status, evidence_count AS "evidenceCount", required, description FROM verification_requirements WHERE case_id = (SELECT id FROM verification_cases WHERE asset_id = $1 ORDER BY opened_at DESC LIMIT 1) ORDER BY created_at', [id]);
  const items = reqs.rows.map(r => ({ ...r, weight: weights[r.code] || 10, ready: !r.required || (r.status === 'accepted' && r.evidenceCount > 0) }));
  const total = items.filter(x => x.required).reduce((s, x) => s + x.weight, 0) || 1;
  const earned = items.filter(x => x.required).reduce((s, x) => s + (x.ready ? x.weight : 0), 0);
  const missing = items.filter(x => x.required && !x.ready).map(x => x.code);
  const completeness = Math.round((earned / total) * 100);
  const conflicting = await db.query("SELECT COUNT(*)::int AS count FROM asset_evidence WHERE asset_id = $1 AND status = 'conflict'", [id]);
  const expired = await db.query("SELECT COUNT(*)::int AS count FROM asset_documents WHERE asset_id = $1 AND status = 'expired'", [id]);
  const conflictCount = Number(conflicting.rows[0].count); const expiredCount = Number(expired.rows[0].count);
  res.json({ asset: asset.rows[0], completeness, readiness: completeness >= 100 && !conflictCount && !expiredCount ? 'ready_for_decision' : completeness >= 70 ? 'partially_ready' : 'evidence_required', missingRequirements: missing, conflicts: conflictCount, expiredDocuments: expiredCount, requirements: items });
}