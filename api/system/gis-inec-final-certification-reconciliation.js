import { db } from 'hatchable';

export const access = 'admin';
export const methods = ['POST'];

const ALGORITHM = '391.20.1';
const POLICY = 'EXISTING_GIS_PRODUCTION_CERTIFICATION_POLICY_UNVERSIONED';
const FINAL_STATES = new Set([
  'CERTIFICATION_ELIGIBLE',
  'REVIEW_APPROVED_BUT_NOT_CERTIFICATION_ELIGIBLE',
  'REVIEW_REQUIRED',
  'EVIDENCE_INSUFFICIENT',
  'EVIDENCE_CONFLICT',
  'EVIDENCE_REJECTED',
  'EVIDENCE_UNVERIFIED',
  'GEOGRAPHY_UNVERIFIED',
  'GEOGRAPHY_CONFLICT',
  'GEOMETRY_INVALID'
]);

const hash = async value => {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2, '0')).join('');
};

const q = async (sql, params = []) => (await db.query(sql, params)).rows;

async function tableExists(name) {
  const rows = await q("SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema=current_schema() AND table_name=$1) AS exists", [name]);
  return rows[0]?.exists === true;
}

async function columns(name) {
  return q("SELECT column_name,data_type,udt_name FROM information_schema.columns WHERE table_schema=current_schema() AND table_name=$1 ORDER BY ordinal_position", [name]);
}

function pick(row, names) {
  for (const n of names) if (row && Object.prototype.hasOwnProperty.call(row, n) && row[n] != null) return row[n];
  return null;
}

function gate(id, status, reason, evidence_reference = null) {
  return { id, status, reason, evidence_reference };
}

export default async function (req, res) {
  const candidateId = req.body?.candidate_id;
  if (!candidateId || typeof candidateId !== 'string' || candidateId.length > 200) {
    return res.status(400).json({ phase: '391.20', error: 'existing candidate_id is required', production_gate: 'NOT_READY' });
  }

  const candidate = (await q(`SELECT id,state_name,lga_name,candidate_area_code,status,confidence,evidence_reference,exception_id FROM gis_exception_candidate_matches WHERE id=$1 LIMIT 1`, [candidateId]))[0];
  if (!candidate) return res.status(404).json({ phase: '391.20', candidate_id: candidateId, error: 'candidate_not_found', production_gate: 'NOT_READY' });

  const has39118 = await tableExists('gis_inec_geographic_reconciliation_decisions');
  const has39119Review = await tableExists('gis_exception_reviews');
  const hasFinal = await tableExists('gis_inec_final_certification_reconciliations');
  const hasAudit = await tableExists('gis_inec_final_certification_audits');

  const missingLineage = [];
  if (!has39118) missingLineage.push('Phase 391.18 reconciliation table is not present in the current production schema');
  if (!has39119Review) missingLineage.push('Phase 391.19 review-decision table is not present in the current production schema');
  if (!hasFinal || !hasAudit) missingLineage.push('Phase 391.20 persistence migration is not applied');

  let phase39118 = null;
  if (has39118) {
    const rows = await q(`SELECT id,decision,decision_fingerprint,inec_evidence_reference,artifact_id,artifact_sha256,provenance_reference,geometry_metadata,spatial_evidence,errors,algorithm_version,candidate_mutation FROM gis_inec_geographic_reconciliation_decisions WHERE candidate_match_id=$1 AND algorithm_version LIKE '391.18%' ORDER BY decided_at DESC NULLS LAST,id DESC LIMIT 1`, [candidateId]);
    phase39118 = rows[0] || null;
  }

  let review = null;
  if (has39119Review) {
    const rows = await q(`SELECT id,exception_id,reviewer_id,decision,rationale,evidence_reference,created_at FROM gis_exception_reviews WHERE exception_id=$1 ORDER BY created_at DESC,id DESC LIMIT 1`, [candidate.exception_id]);
    review = rows[0] || null;
  }

  const reviewState = review ? (review.decision === 'EVIDENCE_ACCEPTED' ? 'APPROVED' : review.decision === 'EVIDENCE_REJECTED' ? 'REJECTED' : 'REVIEW_REQUIRED') : null;
  const reviewDecision = review?.decision || null;
  const phase39118Decision = phase39118?.decision || null;

  const gates = [];
  gates.push(gate('phase39118_lineage', phase39118 ? 'PASS' : 'BLOCKED', phase39118 ? 'Actual Phase 391.18 decision exists' : 'No actual Phase 391.18 decision exists for this candidate', phase39118?.id || null));
  gates.push(gate('phase39119_review_lineage', review ? 'PASS' : 'BLOCKED', review ? 'Actual Phase 391.19 review context exists' : 'No actual Phase 391.19 review decision exists for this candidate', review?.id || null));
  gates.push(gate('candidate_status_integrity', candidate.status ? 'PASS' : 'FAIL', candidate.status ? 'Candidate status is present' : 'Candidate status is missing'));

  if (!phase39118) {
    missingLineage.push('No actual Phase 391.18 decision record exists for this candidate');
  }
  if (!review) {
    missingLineage.push('No actual Phase 391.19 review decision exists for this candidate');
  }

  const hardFailures = [];
  if (phase39118?.artifact_id && !phase39118?.artifact_sha256) hardFailures.push('Phase 391.18 artifact reference has no recorded SHA-256');
  if (phase39118?.errors && Array.isArray(phase39118.errors) && phase39118.errors.length) hardFailures.push('Phase 391.18 recorded validation errors');
  if (phase39118?.candidate_mutation === true) hardFailures.push('Phase 391.18 indicates a candidate mutation; final certification will not repeat or override it');

  let finalDecision = 'REVIEW_REQUIRED';
  if (hardFailures.length) finalDecision = 'EVIDENCE_CONFLICT';
  else if (!phase39118) finalDecision = 'GEOGRAPHY_UNVERIFIED';
  else if (!review) finalDecision = 'REVIEW_REQUIRED';
  else if (reviewDecision === 'EVIDENCE_REJECTED') finalDecision = 'EVIDENCE_REJECTED';
  else if (reviewDecision === 'INSUFFICIENT_EVIDENCE') finalDecision = 'EVIDENCE_INSUFFICIENT';
  else if (reviewDecision === 'CONFLICT_REQUIRES_ESCALATION') finalDecision = 'EVIDENCE_CONFLICT';
  else if (reviewDecision === 'EVIDENCE_ACCEPTED') finalDecision = 'REVIEW_APPROVED_BUT_NOT_CERTIFICATION_ELIGIBLE';
  else finalDecision = 'EVIDENCE_UNVERIFIED';

  const policyEligible = phase39118 && review && reviewDecision === 'EVIDENCE_ACCEPTED' &&
    ['GEOGRAPHY_CONFIRMED','GEOGRAPHY_CONFIRMED_BY_EXPLICIT_CROSSWALK'].includes(phase39118Decision) &&
    hardFailures.length === 0;

  if (policyEligible) {
    gates.push(gate('authoritative_geography', 'PASS', 'Phase 391.18 decision is an allowed authoritative geographic result', phase39118.id));
    gates.push(gate('review_approval', 'PASS', 'Actual authorized Phase 391.19 approval is present', review.id));
  } else {
    gates.push(gate('authoritative_geography', 'BLOCKED', 'Existing evidence chain does not prove authoritative geography under the current policy', phase39118?.id || null));
    gates.push(gate('review_approval', reviewDecision === 'EVIDENCE_ACCEPTED' ? 'PASS' : 'BLOCKED', review ? `Review decision is ${reviewDecision || 'unknown'}` : 'Review decision missing', review?.id || null));
  }

  // Read the same authoritative conditions used by the existing production certification endpoint.
  // This is an integration check, not a replacement certification system.
  const certRows = await q("SELECT (SELECT COUNT(*)::int FROM gis_exception_candidate_matches) AS total, (SELECT COUNT(*)::int FROM gis_exception_candidate_matches WHERE status='RESOLVED') AS resolved, (SELECT COUNT(*)::int FROM gis_ward_evidence_attachments WHERE verification_status='VERIFIED' AND authority_level='PRIMARY_OFFICIAL' AND geometry_verified=true AND provenance_verified=true AND artifact_sha256 IS NOT NULL) AS verified_evidence, (SELECT COUNT(*)::int FROM inec_official_artifacts WHERE canonical_source_key='INEC-POLLING-UNIT-LOCATOR-2026' AND sha256 IS NOT NULL AND provenance_status='SOURCE_BOUND_AND_HASH_VERIFIED') AS qualified_artifacts, (SELECT COUNT(*)::int FROM inec_official_artifacts a LEFT JOIN gis_canonical_source_identity c ON c.source_key=a.canonical_source_key WHERE a.canonical_source_key='INEC-POLLING-UNIT-LOCATOR-2026' AND c.source_registry_id IS NULL) AS integrity_failures");
  const cert = certRows[0];
  const certReady = Number(cert.total) > 0 && Number(cert.resolved) === Number(cert.total) && Number(cert.verified_evidence) >= Number(cert.total) && Number(cert.qualified_artifacts) > 0 && Number(cert.integrity_failures) === 0;
  gates.push(gate('artifact_integrity', Number(cert.qualified_artifacts) > 0 ? 'PASS' : 'BLOCKED', `${cert.qualified_artifacts} qualified INEC artifact(s) under existing certification query`));
  gates.push(gate('candidate_resolution', Number(cert.resolved) === Number(cert.total) ? 'PASS' : 'BLOCKED', `${cert.resolved}/${cert.total} candidates are RESOLVED under the existing certification query`));
  gates.push(gate('qualifying_evidence', Number(cert.verified_evidence) >= Number(cert.total) ? 'PASS' : 'BLOCKED', `${cert.verified_evidence}/${cert.total} candidates have qualifying primary-official evidence under the existing certification query`));
  gates.push(gate('canonical_source_integrity', Number(cert.integrity_failures) === 0 ? 'PASS' : 'FAIL', `${cert.integrity_failures} canonical-source integrity failure(s)`));
  gates.push(gate('production_certification', certReady ? 'PASS' : 'BLOCKED', certReady ? 'Existing production certification conditions currently pass' : 'Existing production certification conditions do not currently pass'));
  const failedGates = gates.filter(g => g.status === 'FAIL' || g.status === 'BLOCKED');
  if (finalDecision === 'REVIEW_APPROVED_BUT_NOT_CERTIFICATION_ELIGIBLE' && policyEligible) finalDecision = 'REVIEW_APPROVED_BUT_NOT_CERTIFICATION_ELIGIBLE';

  const evidenceChain = {
    candidate_id: candidate.id,
    geometry: phase39118?.geometry_metadata || null,
    geometry_source: pick(phase39118?.geometry_metadata, ['source','geometry_source']),
    crosswalk: phase39118?.inec_evidence_reference || null,
    inec_evidence: phase39118?.inec_evidence_reference || null,
    artifact_id: phase39118?.artifact_id || null,
    artifact_sha256: phase39118?.artifact_sha256 || null,
    provenance: phase39118?.provenance_reference || null,
    review: review ? { id: review.id, state: reviewState, decision: reviewDecision } : null,
    policy_version: POLICY,
    broken_links: missingLineage.concat(hardFailures)
  };

  const fingerprintInput = JSON.stringify({
    candidate_id: candidate.id,
    phase39118_fingerprint: phase39118?.decision_fingerprint || null,
    phase39119_review_fingerprint: pick(review, ['review_fingerprint','fingerprint']),
    evidence_ids: phase39118?.inec_evidence_reference || null,
    artifact_id: phase39118?.artifact_id || null,
    artifact_sha256: phase39118?.artifact_sha256 || null,
    policy_version: POLICY,
    certification_algorithm_version: ALGORITHM,
    final_decision: finalDecision
  });
  const fingerprint = await hash(fingerprintInput);

  let auditId = null;
  if (hasFinal && hasAudit) {
    const existing = (await q(`SELECT id,audit_id FROM gis_inec_final_certification_reconciliations WHERE deterministic_fingerprint=$1 LIMIT 1`, [fingerprint]))[0];
    if (existing) auditId = existing.audit_id || null;
    else {
      const rec = (await q(`INSERT INTO gis_inec_final_certification_reconciliations(candidate_match_id,previous_status,proposed_status,final_decision,phase39118_decision,phase39119_review_state,review_decision,evidence_ids,artifact_id,artifact_sha256,canonical_source,parser_version,validation_version,provenance_reference,geometry_source,geometry_record_id,crosswalk_id,policy_version,certification_algorithm_version,gate_results,failed_gates,evidence_chain,validation_errors,deterministic_fingerprint,candidate_mutation,geometry_mutation,evidence_mutation) VALUES($1,$2,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,false,false,false) ON CONFLICT(deterministic_fingerprint) DO NOTHING RETURNING id`, [candidate.id,candidate.status,finalDecision,phase39118Decision,reviewState,reviewDecision,JSON.stringify(phase39118?.inec_evidence_reference || []),phase39118?.artifact_id || null,phase39118?.artifact_sha256 || null,null,null,null,JSON.stringify(phase39118?.provenance_reference || null),evidenceChain.geometry_source, pick(phase39118?.geometry_metadata,['record_id','geometry_record_id']), pick(phase39118?.inec_evidence_reference,['crosswalk_id']), POLICY,ALGORITHM,JSON.stringify(gates),JSON.stringify(failedGates),JSON.stringify(evidenceChain),JSON.stringify(missingLineage.concat(hardFailures)),fingerprint]))[0];
      if (rec) {
        const audit = (await q(`INSERT INTO gis_inec_final_certification_audits(reconciliation_id,candidate_match_id,previous_status,proposed_status,final_decision,evidence_ids,artifact_id,artifact_sha256,provenance_reference,reviewer_reference,authorization_context,deterministic_fingerprint,event_type) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT(deterministic_fingerprint,event_type) DO NOTHING RETURNING id`, [rec.id,candidate.id,candidate.status,candidate.status,finalDecision,JSON.stringify(phase39118?.inec_evidence_reference || []),phase39118?.artifact_id || null,phase39118?.artifact_sha256 || null,JSON.stringify(phase39118?.provenance_reference || null),pick(review,['reviewer_id','reviewer']),JSON.stringify({member_id:req.member?.id||null,role:req.member?.role||null}),fingerprint,'FINAL_CERTIFICATION_RECONCILIATION']))[0];
        auditId = audit?.id || null;
        if (auditId) await db.query(`UPDATE gis_inec_final_certification_reconciliations SET audit_id=$1 WHERE id=$2`, [auditId, rec.id]);
      }
    }
  }

  if (policyEligible && certReady && missingLineage.length === 0) finalDecision = 'CERTIFICATION_ELIGIBLE';
  const productionGate = certReady && finalDecision === 'CERTIFICATION_ELIGIBLE' ? 'READY' : 'NOT_READY';
  const proposedStatus = candidate.status;
  res.status(200).json({
    phase: '391.20',
    candidate_id: candidate.id,
    previous_status: candidate.status,
    proposed_status: proposedStatus,
    final_decision: finalDecision,
    Phase_39118_decision: phase39118Decision,
    Phase_39119_review_state: reviewState,
    review_decision: reviewDecision,
    evidence_ids: phase39118?.inec_evidence_reference || [],
    artifact_id: phase39118?.artifact_id || null,
    artifact_sha256: phase39118?.artifact_sha256 || null,
    canonical_source: null,
    parser_version: null,
    validation_version: null,
    provenance_reference: phase39118?.provenance_reference || null,
    geometry_source: evidenceChain.geometry_source,
    geometry_record_id: pick(phase39118?.geometry_metadata, ['record_id','geometry_record_id']),
    crosswalk_id: pick(phase39118?.inec_evidence_reference, ['crosswalk_id']),
    policy_version: POLICY,
    certification_algorithm_version: ALGORITHM,
    gate_results: gates,
    failed_gates: failedGates,
    deterministic_fingerprint: fingerprint,
    candidate_mutation: false,
    audit_id: auditId,
    production_gate: productionGate,
    validation_errors: missingLineage.concat(hardFailures),
    evidence_chain: evidenceChain,
    lineage_status: missingLineage.length ? 'BLOCKED' : 'AVAILABLE',
    note: 'Phase 391.20 is fail-closed. Candidate status, geometry and evidence are never mutated by this reconciliation.'
  });
}