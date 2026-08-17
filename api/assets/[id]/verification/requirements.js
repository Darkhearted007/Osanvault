import { db } from 'hatchable';
export const access = 'admin';
export const methods = ['POST'];
export default async function (req, res) {
  const caseId = req.body?.caseId;
  const requirements = req.body?.requirements;
  if (!caseId || !Array.isArray(requirements) || !requirements.length) return res.status(400).json({ error: 'caseId and requirements are required' });
  const created = [];
  for (const r of requirements) {
    if (!r.code || !r.title) continue;
    const row = await db.query('INSERT INTO verification_requirements (case_id, requirement_code, title, description, required, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, requirement_code AS "requirementCode", title, status', [caseId, r.code, r.title, r.description || null, r.required !== false, 'pending']);
    created.push(row.rows[0]);
  }
  res.status(201).json(created);
}