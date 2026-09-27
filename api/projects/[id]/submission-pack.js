import { db } from 'hatchable';
import { authorizeTenant, tenantError } from '../../../lib/tenantAuthority.js';
export const access='member'; export const methods=['GET'];
export default async function(req,res){
 const id=req.params.id;
 const project=await db.query('SELECT id,organization_id AS "organizationId",name,status,project_identifier AS "projectIdentifier" FROM projects WHERE id=$1',[id]);
 if(!project.rows.length)return res.status(404).json({error:'Project not found'});
 if(!project.rows[0].organizationId)return res.status(403).json({error:'project_not_tenant_assigned'});
 const tenant=await authorizeTenant(req,project.rows[0].organizationId,'capital:read'); if(!tenant.allowed)return tenantError(res,tenant);
 const assetQ=await db.query('SELECT pa.asset_id AS "assetId" FROM project_assets pa WHERE pa.project_id=$1 ORDER BY CASE WHEN pa.relationship=$2 THEN 0 ELSE 1 END LIMIT 1',[id,'primary']);
 const assetId=assetQ.rows[0]?.assetId||null;
 const [p,passport,readiness,sources,evidence,remediation,diligence,rooms,submissions]=await Promise.all([
  db.query('SELECT id,capital_required,minimum_capital,maximum_capital,currency,use_of_funds,revenue_model,development_stage,capital_readiness_score,capital_readiness_state FROM canonical_capital_profiles WHERE project_id=$1',[id]),
  db.query('SELECT passport_version AS "passportVersion",passport_status AS "passportStatus",evidence_state AS "evidenceState",readiness_state AS "readinessState",overall_readiness_score AS "overallReadinessScore",blocker_count AS "blockerCount",source_count AS "sourceCount",evidence_count AS "evidenceCount",verified_evidence_count AS "verifiedEvidenceCount",summary,generated_at AS "generatedAt",canonical_hash AS "canonicalHash" FROM project_intelligence_passports WHERE project_id=$1 AND status=$2 ORDER BY created_at DESC LIMIT 1',[id,'Active']),
  db.query('SELECT * FROM project_capital_readiness WHERE project_id=$1 ORDER BY assessed_at DESC LIMIT 1',[id]),
  db.query("SELECT organization_name,organization_type,mandate FROM institutional_profiles WHERE status='active' ORDER BY organization_name"),
  assetId?db.query('SELECT id,evidence_type,status,verification_status FROM asset_evidence WHERE asset_id=$1 ORDER BY created_at DESC',[assetId]):{rows:[]},
  db.query("SELECT blocker_code,title,status,priority,required_evidence FROM intelligence_remediation_items WHERE subject_type='project' AND subject_id=$1 ORDER BY priority DESC,created_at",[id]),
  db.query('SELECT id,institution_id AS "institutionId",status,scope,findings,opened_at AS "openedAt",completed_at AS "completedAt" FROM institutional_due_diligence WHERE project_id=$1 ORDER BY opened_at DESC',[id]),
  assetId?db.query('SELECT id,institution_id AS "institutionId",name,status,created_at AS "createdAt" FROM institutional_data_rooms WHERE asset_id=$1 ORDER BY created_at DESC',[assetId]):{rows:[]},
  db.query('SELECT id,match_id AS "matchId",status,outcome,review_status AS "reviewStatus",submitted_at AS "submittedAt",decision_at AS "decisionAt" FROM institutional_submissions WHERE project_id=$1 ORDER BY created_at DESC',[id])
 ]);
 const hasOpenRemediation=remediation.rows.some(x=>x.status!=='completed');
 const hasSubmission=submissions.rows.some(x=>['submitted','under_review'].includes(x.status));
 res.json({project:project.rows[0],assetId,capitalProfile:p.rows[0]?{id:p.rows[0].id,capitalRequired:p.rows[0].capital_required,minCapital:p.rows[0].minimum_capital,maxCapital:p.rows[0].maximum_capital,currency:p.rows[0].currency,useOfFunds:p.rows[0].use_of_funds,revenueModel:p.rows[0].revenue_model,developmentStage:p.rows[0].development_stage,capitalReadinessScore:p.rows[0].capital_readiness_score,capitalReadinessState:p.rows[0].capital_readiness_state}:null,passport:passport.rows[0]||null,readiness:readiness.rows[0]||null,institutionalSources:sources.rows,evidenceIndex:evidence.rows,openRemediation:remediation.rows.filter(x=>x.status!=='completed'),diligence:diligence.rows,dataRooms:rooms.rows,submissions:submissions.rows,submissionState:hasSubmission?'submitted':(hasOpenRemediation?'conditional':'candidate'),disclaimer:'Submission packs summarize platform records for diligence. They do not constitute financing approval, valuation, investment advice, legal opinion, or a guarantee.'});
}