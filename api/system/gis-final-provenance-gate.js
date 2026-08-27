import { db, storage } from 'hatchable';

export const access = 'admin';
export const methods = ['GET'];

const SOURCE_KEY = 'INEC-POLLING-UNIT-LOCATOR-2026';
const SOURCE_ID = '1a17203d-270d-475c-99ae-871d232397be';

async function sha256Hex(buffer) {
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}

export default async function (req, res) {
  const source = (await db.query(
    `SELECT source_registry_id AS id, source_key, source_url, authority_level
     FROM gis_canonical_source_identity
     WHERE source_registry_id=$1 AND source_key=$2`,
    [SOURCE_ID, SOURCE_KEY]
  )).rows[0];

  if (!source) return res.status(409).json({ phase: '391.28', production_gate: 'NOT_READY', error: 'canonical source identity missing or inconsistent' });

  const artifact = (await db.query(
    `SELECT id, sha256, storage_key, byte_size, content_type, retrieval_status, verification_status, provenance_status
     FROM inec_official_artifacts
     WHERE canonical_source_key=$1
     ORDER BY created_at DESC LIMIT 1`,
    [SOURCE_KEY]
  )).rows[0] || null;

  let recomputedSha256 = null;
  let storageIntegrity = 'NOT_CHECKED';
  let contentValidation = 'NOT_CHECKED';
  let contentBytes = null;

  if (artifact?.storage_key) {
    try {
      const stored = await storage.get(artifact.storage_key);
      contentBytes = stored?.buffer || null;
      if (contentBytes) {
        recomputedSha256 = await sha256Hex(contentBytes);
        storageIntegrity = recomputedSha256 === artifact.sha256 ? 'MATCH' : 'MISMATCH';
        const bytes = new Uint8Array(contentBytes);
        const prefix = new TextDecoder().decode(bytes.slice(0, 16));
        const text = new TextDecoder().decode(bytes);
        const htmlLike = /^\\s*</.test(prefix) && /(?:INEC|Independent National Electoral Commission)/i.test(text) && /(?:Polling Unit|polling-unit|polling unit)/i.test(text);
        contentValidation = htmlLike ? 'VALIDATED_OFFICIAL_LOCATOR_CONTENT' : 'REJECTED_CONTENT_SIGNATURE';
      } else storageIntegrity = 'MISSING_STORAGE_BYTES';
    } catch (e) {
      storageIntegrity = 'STORAGE_READ_FAILED';
    }
  }

  const artifactIntegrity = artifact?.retrieval_status === 'RETRIEVED' && artifact?.sha256 && storageIntegrity === 'MATCH';
  const provenance = artifact?.provenance_status === 'SOURCE_BOUND_AND_HASH_VERIFIED';
  const fullyCertifiedArtifact = Boolean(artifactIntegrity && provenance && contentValidation === 'VALIDATED_OFFICIAL_LOCATOR_CONTENT');

  const parsed = (await db.query(
    `SELECT COUNT(*)::int AS n FROM gis_official_artifact_rows WHERE artifact_id=$1`,
    [artifact?.id || '00000000-0000-0000-0000-000000000000']
  )).rows[0]?.n || 0;
  const verified = (await db.query(`SELECT COUNT(*)::int AS n FROM gis_ward_evidence_attachments WHERE verification_status='VERIFIED'`)).rows[0]?.n || 0;
  const reviewed = (await db.query(`SELECT COUNT(*)::int AS n FROM gis_exception_reviews`)).rows[0]?.n || 0;
  const promoted = (await db.query(`SELECT COUNT(*)::int AS n FROM gis_exception_promotion_audit`)).rows[0]?.n || 0;

  const candidates = (await db.query(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status='CANDIDATE_ONLY')::int AS candidate_only, COUNT(*) FILTER (WHERE status='RESOLVED')::int AS resolved FROM gis_exception_candidate_matches`)).rows[0];

  const gate = fullyCertifiedArtifact && parsed > 0 && verified > 0 && reviewed > 0 && promoted > 0 ? 'READY' : 'NOT_READY';

  const audit = await db.query(
    `INSERT INTO gis_final_provenance_gate_audits
      (phase,source_id,source_key,artifact_id,recorded_sha256,recomputed_sha256,byte_size,content_type,provenance_status,integrity_status,parsed_records,verified_candidates,reviewed_candidates,promoted_candidates,production_gate)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     RETURNING id`,
    ['391.28', source.id, source.source_key, artifact?.id || null, artifact?.sha256 || null, recomputedSha256, artifact?.byte_size || null, artifact?.content_type || null, provenance ? 'VERIFIED' : (artifact?.provenance_status || 'MISSING'), storageIntegrity, parsed, verified, reviewed, promoted, gate]
  );

  res.status(200).json({
    phase: '391.28',
    audit_id: audit.rows[0].id,
    source,
    artifact: artifact ? { id: artifact.id, recorded_sha256: artifact.sha256, recomputed_sha256: recomputedSha256, byte_size: artifact.byte_size, content_type: artifact.content_type, retrieval_status: artifact.retrieval_status, provenance_status: artifact.provenance_status, verification_status: artifact.verification_status, storage_integrity: storageIntegrity, content_validation: contentValidation, fully_certified: fullyCertifiedArtifact } : null,
    candidates,
    chain: { parsed_records: parsed, independently_verified: verified, admin_reviewed: reviewed, promotion_audits: promoted },
    production_gate: gate,
    policy: 'Observation-only final gate. No candidate, evidence, verification, review, or promotion state is mutated.'
  });
}