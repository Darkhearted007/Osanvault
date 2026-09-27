import { db } from 'hatchable';
import { authorizeTenant, tenantError } from 'lib/tenantAuthority.js';
export const access='member'; export const methods=['GET'];
export default async function(req,res){
 const room=await db.query('SELECT d.id,d.asset_id,d.institution_id,d.status,d.created_at AS "createdAt",oa.organization_id AS "organizationId" FROM institutional_data_rooms d JOIN gis_organization_assets oa ON oa.asset_id=d.asset_id WHERE d.id=$1',[req.params.id]);
 if(!room.rows.length)return res.status(404).json({error:'Data room not found'});
 const tenant=await authorizeTenant(req,room.rows[0].organizationId,'capital:read'); if(!tenant.allowed)return tenantError(res,tenant);
 const r=room.rows[0];
 const [asset,report,remediation,fulfilment,graph]=await Promise.all([
  db.query('SELECT a.id,a.asset_identifier AS "assetIdentifier",a.name,a.status,t.name AS "assetTypeName" FROM assets a LEFT JOIN asset_types t ON t.id=a.asset_type_id WHERE a.id=$1',[r.asset_id]),
  db.query('SELECT overall_score AS "overallScore",evidence_score AS "evidenceScore",verification_score AS "verificationScore",project_readiness_score AS "projectReadinessScore",intelligence_state AS state FROM asset_intelligence_assessments WHERE asset_id=$1 ORDER BY assessed_at DESC LIMIT 1',[r.asset_id]),
  db.query(`SELECT id,blocker_code AS "blockerCode",title,status,priority,required_evidence AS "requiredEvidence" FROM intelligence_remediation_items WHERE subject_type='asset' AND subject_id=$1 ORDER BY priority DESC,created_at`,[r.asset_id]),
  db.query('SELECT f.id,f.request_id AS "requestId",f.evidence_id AS "evidenceId",f.status,f.submitted_at AS "submittedAt",f.verified_at AS "verifiedAt",q.title,q.required_evidence AS "requiredEvidence",q.status AS "requestStatus" FROM institutional_evidence_fulfilment f JOIN institutional_evidence_requests q ON q.id=f.request_id WHERE q.room_id=$1 ORDER BY f.created_at DESC',[r.id]),
  db.query(`SELECT id,from_type AS "fromType",relationship_type AS "relationshipType",to_type AS "toType",status,confidence FROM economic_graph_relationships WHERE (from_type='asset' AND from_id=$1) OR (to_type='asset' AND to_id=$1) ORDER BY created_at DESC`,[r.asset_id])
 ]);
 const score=Number(report.rows[0]?.overallScore||0);
 const eligible=!!report.rows[0]&&score>=70&&remediation.rows.every(x=>x.status==='completed');
 res.json({room:r,asset:asset.rows[0]||null,intelligence:report.rows[0]||null,decision:report.rows[0]?{eligibleForInstitutionalDiligence:eligible,...report.rows[0]}:null,remediation:remediation.rows,fulfilment:fulfilment.rows,graph:graph.rows});
}