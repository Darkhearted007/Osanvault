import { db } from 'hatchable';
import { authorizeTenant, tenantError } from '../../../lib/tenantAuthority.js';
export const access = 'member';
export const methods = ['GET','POST'];
export default async function (req, res) {
  const id = req.params.id;
  const ownership=(await db.query("SELECT organization_id FROM gis_organization_assets WHERE asset_id=$1 LIMIT 1",[id])).rows[0];
  if(!ownership)return res.status(403).json({error:'asset_not_tenant_assigned'});
  const tenant=await authorizeTenant(req,ownership.organization_id,req.method==='GET'?'opportunity:read':'opportunity:write');
  if(!tenant.allowed)return tenantError(res,tenant);
  if (req.method === 'GET') {
    const { rows } = await db.query('SELECT id, opportunity_type AS "opportunityType", thesis, estimated_capital_required AS "estimatedCapitalRequired", currency, development_horizon_months AS "developmentHorizonMonths", expected_impact AS "expectedImpact", assumptions, status, created_at AS "createdAt" FROM opportunity_assessments WHERE asset_id = $1 ORDER BY created_at DESC', [id]);
    return res.json(rows);
  }
  if (req.headers['x-role'] !== 'admin') return res.status(403).json({ error: 'Opportunity creation requires an authorized operator' });
  const b = req.body || {};
  if (!b.opportunityType || !b.thesis) return res.status(400).json({ error: 'opportunityType and thesis are required' });
  const row = await db.query('INSERT INTO opportunity_assessments (asset_id, opportunity_type, thesis, estimated_capital_required, currency, development_horizon_months, expected_impact, assumptions, status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id, opportunity_type AS "opportunityType", status, created_at AS "createdAt"', [id,b.opportunityType,b.thesis,b.estimatedCapitalRequired ?? null,b.currency || 'NGN',b.developmentHorizonMonths ?? null,b.expectedImpact || null,JSON.stringify(b.assumptions || {}),'draft']);
  res.status(201).json(row.rows[0]);
}