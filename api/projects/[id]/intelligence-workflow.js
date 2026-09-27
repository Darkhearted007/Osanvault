import { db } from 'hatchable';
import { authorizeTenant, tenantError } from 'lib/tenantAuthority.js';
export const access='member';
export const methods=['GET'];
export default async function(req,res){
 const projectId=String(req.params?.id||'').trim();
 const p=await db.query('SELECT id,name,project_identifier,status,organization_id AS "organizationId" FROM projects WHERE id=$1',[projectId]);
 if(!p.rows.length)return res.status(404).json({error:'Project not found'});
 const tenant=await authorizeTenant(req,p.rows[0].organizationId,'capital:read'); if(!tenant.allowed)return tenantError(res,tenant);
 const asset=await db.query('SELECT pa.asset_id AS "assetId" FROM project_assets pa WHERE pa.project_id=$1 ORDER BY CASE WHEN pa.relationship=$2 THEN 0 ELSE 1 END LIMIT 1',[projectId,'primary']);
 const assetId=asset.rows[0]?.assetId||null;
 const [pass,readiness,gaps,remediation,rooms,subs,diligence]=await Promise.all([
  db.query('SELECT * FROM project_intelligence_passports WHERE project_id=$1 AND status=$2 ORDER BY created_at DESC LIMIT 1',[projectId,'Active']),
  db.query('SELECT * FROM project_capital_readiness WHERE project_id=$1 ORDER BY assessed_at DESC LIMIT 1',[projectId]),
  db.query("SELECT id,domain,requirement_code AS \"requirementCode\",title,priority,blocking,status,evidence_required AS \"evidenceRequired\",evidence_reference AS \"evidenceReference\",owner_reference AS \"ownerReference\",source_reference AS \"sourceReference\",due_date AS \"dueDate\",resolution_notes AS \"resolutionNotes\" FROM project_readiness_gaps WHERE project_id=$1 AND status<>'resolved' ORDER BY blocking DESC,priority DESC",[projectId]),
  db.query("SELECT blocker_code AS \"blockerCode\",title,status,priority,required_evidence AS \"requiredEvidence\" FROM intelligence_remediation_items WHERE subject_type='project' AND subject_id=$1 AND status<>'completed' ORDER BY priority DESC,created_at",[projectId]),
  assetId?db.query('SELECT id,asset_id AS "assetId",institution_id AS "institutionId",name,status,created_at AS "createdAt" FROM institutional_data_rooms WHERE asset_id=$1 ORDER BY created_at DESC',[assetId]):{rows:[]},
  db.query('SELECT id,match_id AS "matchId",status,outcome,review_status AS "reviewStatus",submitted_at AS "submittedAt",decision_at AS "decisionAt",created_at AS "createdAt" FROM institutional_submissions WHERE project_id=$1 ORDER BY created_at DESC',[projectId]),
  db.query('SELECT id,institution_id AS "institutionId",status,scope,findings,opened_at AS "openedAt",completed_at AS "completedAt" FROM institutional_due_diligence WHERE project_id=$1 ORDER BY opened_at DESC',[projectId])
 ]);
 res.json({project:p.rows[0],assetId,passport:pass.rows[0]||null,capitalReadiness:readiness.rows[0]||null,openGaps:gaps.rows,openRemediation:remediation.rows,dataRooms:rooms.rows,submissions:subs.rows,diligence:diligence.rows,workflow:['evidence','readiness','intelligence_passport','institutional_diligence','data_room','submission'],disclaimer:'This workflow is decision-support infrastructure. It does not constitute financing approval, valuation, investment advice, legal opinion, or a guarantee.'});
}