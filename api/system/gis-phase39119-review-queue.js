import { db } from 'hatchable';

export const access='admin';
export const methods=['GET'];

const q=async(sql,p=[]) => (await db.query(sql,p)).rows;

export default async function(req,res){
  const rows=await q(`SELECT c.id AS candidate_id,c.state_name,c.lga_name,c.candidate_area_code,c.status,c.confidence,c.evidence_reference,
    g.id AS phase39118_id,g.decision AS geography_decision,g.decision_fingerprint,g.artifact_id,g.artifact_sha256,
    g.provenance_reference,g.geometry_metadata,g.spatial_evidence,g.errors,
    r.id AS reconciliation_id,r.final_decision AS phase39120_decision,r.deterministic_fingerprint,
    CASE WHEN g.decision='GEOGRAPHY_CONFIRMED' THEN 'GEOGRAPHY_REVIEW_REQUIRED' ELSE 'GEOGRAPHY_EVIDENCE_REQUIRED' END AS review_class
    FROM gis_exception_candidate_matches c
    LEFT JOIN LATERAL (
      SELECT * FROM gis_inec_geographic_reconciliation_decisions x
      WHERE x.candidate_match_id=c.id AND x.algorithm_version LIKE '391.18%'
      ORDER BY x.decided_at DESC,x.id DESC LIMIT 1
    ) g ON true
    LEFT JOIN LATERAL (
      SELECT * FROM gis_inec_final_certification_reconciliations x
      WHERE x.candidate_match_id=c.id
      ORDER BY x.created_at DESC,x.id DESC LIMIT 1
    ) r ON true
    WHERE c.status='CANDIDATE_ONLY'
    ORDER BY c.state_name,c.lga_name,c.candidate_area_code`);
  const queue=rows.map(x=>({
    candidate_id:x.candidate_id,
    administrative_scope:{state:x.state_name,lga:x.lga_name,area_code:x.candidate_area_code},
    current_status:x.status,
    confidence:x.confidence,
    phase39118:{id:x.phase39118_id,decision:x.geography_decision,fingerprint:x.decision_fingerprint,artifact_id:x.artifact_id,artifact_sha256:x.artifact_sha256,provenance:x.provenance_reference,geometry:x.geometry_metadata,spatial_evidence:x.spatial_evidence,errors:x.errors},
    phase39120:{id:x.reconciliation_id,final_decision:x.phase39120_decision,fingerprint:x.deterministic_fingerprint},
    review_class:x.review_class,
    reviewer_action:'Require an authorized human review decision. Do not infer or promote geometry from GRID3/UN SALB or text-only evidence.'
  }));
  res.status(200).json({
    phase:'391.19',
    algorithm_version:'391.19.1',
    source:'EXISTING_ELECTORAL_CERTIFICATION_EVIDENCE',
    candidates:queue,
    count:queue.length,
    decisions_persisted:0,
    candidate_mutations:0,
    geometry_mutations:0,
    certification_gate:queue.length===0?'READY':'NOT_READY',
    policy:'Read-only governed review queue. A queue entry is not a review decision and cannot satisfy certification.'
  });
}