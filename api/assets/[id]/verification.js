import { db } from 'hatchable';
export const access = 'admin';
export const methods = ['GET'];
export default async function (req, res) {
  const assetId = req.params.id;
  const cases = await db.query('SELECT id, status, verification_level AS "verificationLevel", opened_at AS "openedAt", closed_at AS "closedAt" FROM verification_cases WHERE asset_id = $1 ORDER BY opened_at DESC', [assetId]);
  if (!cases.rows.length) return res.status(404).json({ error: 'No verification case' });
  const caseId = cases.rows[0].id;
  const [actions, decisions, requirements] = await Promise.all([
    db.query('SELECT id, action_type AS "actionType", actor, notes, status, created_at AS "createdAt" FROM verification_actions WHERE case_id = $1 ORDER BY created_at DESC', [caseId]),
    db.query('SELECT id, decision, rationale, reviewer, decided_at AS "decidedAt" FROM verification_decisions WHERE case_id = $1 ORDER BY decided_at DESC', [caseId]),
    db.query('SELECT id, requirement_code AS "requirementCode", title, description, required, status, evidence_count AS "evidenceCount" FROM verification_requirements WHERE case_id = $1 ORDER BY created_at', [caseId])
  ]);
  res.json({ case: cases.rows[0], actions: actions.rows, decisions: decisions.rows, requirements: requirements.rows });
}