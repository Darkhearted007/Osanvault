import { db } from 'hatchable';

export const access = 'admin';
export const methods = ['GET'];

export default async function (req, res) {
  const checks = [];
  const blockers = [];

  async function probe(name, sql, params = [], evaluate = null) {
    try {
      const rows = (await db.query(sql, params)).rows;
      const issue = evaluate ? evaluate(rows) : null;
      checks.push({ name, status: issue ? 'BLOCKED' : 'PASS', rows, issue });
      if (issue) blockers.push({ name, issue });
      return rows;
    } catch (e) {
      const error = String(e?.message || e);
      checks.push({ name, status: 'BLOCKED', error });
      blockers.push({ name, error });
      return [];
    }
  }

  await probe('canonical_inec_source',
    "SELECT COUNT(*)::int AS n FROM gis_canonical_source_identity WHERE source_key=$1",
    ['INEC-POLLING-UNIT-LOCATOR-2026'],
    rows => rows[0]?.n !== 1 ? 'canonical source uniqueness/visibility failed' : null);

  await probe('gis_candidate_preservation',
    "SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status='CANDIDATE_ONLY')::int AS candidate_only, COUNT(*) FILTER (WHERE status='RESOLVED')::int AS resolved FROM gis_exception_candidate_matches",
    [],
    rows => rows[0]?.total !== 30 ? 'expected exactly 30 GIS candidates' : null);

  await probe('artifact_integrity',
    "SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE sha256 IS NOT NULL)::int AS hashed, COUNT(*) FILTER (WHERE retrieval_status='FETCH_FAILED')::int AS fetch_failed FROM inec_official_artifacts",
    [],
    rows => rows[0]?.fetch_failed > 0 && rows[0]?.hashed === 0 ? 'no successfully hashed artifact is currently available' : null);

  await probe('evidence_verification',
    "SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE verification_status='VERIFIED')::int AS verified FROM gis_ward_evidence_attachments");

  await probe('verification_cases',
    "SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status='open')::int AS open_cases FROM verification_cases");

  await probe('admin_security_controls',
    "SELECT COUNT(*)::int AS n FROM security_controls WHERE enabled=true AND required_access='admin'",
    [],
    rows => rows[0]?.n < 1 ? 'no enabled admin security control found' : null);

  await probe('tenant_security_controls',
    "SELECT COUNT(*)::int AS n FROM tenant_security_controls WHERE enabled=true",
    [],
    rows => rows[0]?.n < 1 ? 'tenant security controls are not enabled' : null);

  const decision = blockers.length ? 'BLOCKED' : 'OBSERVED';
  const productionGate = blockers.length ? 'NOT_READY' : 'NOT_READY';
  const audit = await db.query(
    'INSERT INTO cross_system_certification_audits(phase,checks,blockers,decision,production_gate,notes) VALUES($1,$2,$3,$4,$5,$6) RETURNING id',
    ['391.8', JSON.stringify(checks), JSON.stringify(blockers), decision, productionGate, 'Observation-only certification audit; no candidate, evidence, verification, financial, tenant, or promotion mutation.']
  );

  res.status(blockers.length ? 409 : 200).json({
    phase: '391.8',
    auditId: audit.rows[0].id,
    decision,
    checks,
    blockers,
    production_gate: productionGate
  });
}