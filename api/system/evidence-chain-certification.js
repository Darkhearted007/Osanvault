import { db } from 'hatchable';
export const access='admin';
export const methods=['GET'];
export default async function(req,res){
 const checks=[];
 const art=(await db.query("SELECT COUNT(*)::int total,COUNT(*) FILTER (WHERE retrieval_status='RETRIEVED')::int retrieved,COUNT(*) FILTER (WHERE sha256 IS NOT NULL)::int hashed,COUNT(*) FILTER (WHERE provenance_status='VERIFIED')::int provenance_verified,COUNT(*) FILTER (WHERE verification_status='VERIFIED')::int integrity_verified FROM inec_official_artifacts WHERE canonical_source_key='INEC-POLLING-UNIT-LOCATOR-2026'")).rows[0];
 const ev=(await db.query("SELECT COUNT(*)::int total,COUNT(*) FILTER (WHERE verification_status='VERIFIED')::int verified FROM gis_ward_evidence_attachments")).rows[0];
 const cand=(await db.query("SELECT COUNT(*)::int total,COUNT(*) FILTER (WHERE status='CANDIDATE_ONLY')::int candidate_only,COUNT(*) FILTER (WHERE status='RESOLVED')::int resolved FROM gis_exception_candidate_matches")).rows[0];
 const reviews=(await db.query("SELECT COUNT(*)::int total FROM gis_exception_reviews")).rows[0];
 const promos=(await db.query("SELECT COUNT(*)::int total FROM gis_exception_promotion_audit")).rows[0];
 checks.push({stage:'artifact',...art});checks.push({stage:'evidence',...ev});checks.push({stage:'candidates',...cand});checks.push({stage:'admin_review',...reviews});checks.push({stage:'promotion_audit',...promos});
 const complete=art.retrieved>0&&art.hashed>0&&art.provenance_verified>0&&art.integrity_verified>0&&ev.verified>0&&cand.resolved>0&&reviews.total>0&&promos.total>0;
 res.status(200).json({phase:'391.9',checks,complete,production_gate:complete?'READY':'NOT_READY',policy:'Certification is observational and fail-closed; no evidence, candidate, review, or promotion records are created by this endpoint.'});
}