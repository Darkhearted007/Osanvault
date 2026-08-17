import { db } from 'hatchable';
export const access='member';
export const methods=['GET','POST','PUT'];
const statuses=['open','in_review','awaiting_evidence','completed','closed'];
const decisions=['pending','proceed','proceed_with_conditions','hold','decline'];
export default async function(req,res){
 const projectId=req.params.id;
 if(req.method==='GET'){
  const cases=await db.query('SELECT id,institution_id AS "institutionId",project_id AS "projectId",asset_id AS "assetId",status,scope,findings,opened_by AS "openedBy",opened_at AS "openedAt",completed_at AS "completedAt" FROM institutional_due_diligence WHERE project_id=$1 ORDER BY opened_at DESC',[projectId]);
  const reviews=await db.query('SELECT r.id,r.submission_id AS "submissionId",r.reviewer,r.decision,r.notes,r.created_at AS "createdAt" FROM submission_reviews r JOIN institutional_submissions s ON s.id=r.submission_id WHERE s.project_id=$1 ORDER BY r.created_at DESC',[projectId]);
  const requests=await db.query('SELECT r.id,r.submission_id AS "submissionId",r.request_type AS "requestType",r.title,r.description,r.required_evidence AS "requiredEvidence",r.status,r.requested_by AS "requestedBy",r.resolved_at AS "resolvedAt" FROM data_room_requests r JOIN institutional_data_rooms d ON d.id=r.room_id WHERE d.asset_id=(SELECT asset_id FROM projects WHERE id=$1) ORDER BY r.created_at DESC',[projectId]);
  return res.json({projectId,cases:cases.rows,reviews:reviews.rows,requests:requests.rows});
 }
 if(req.method==='POST'){
  const b=req.body||{}; if(!b.institutionId)return res.status(400).json({error:'institutionId is required'});
  const p=await db.query('SELECT asset_id FROM projects WHERE id=$1',[projectId]); if(!p.rows.length)return res.status(404).json({error:'Project not found'});
  const r=await db.query('INSERT INTO institutional_due_diligence(institution_id,project_id,asset_id,status,scope,findings,opened_by,opened_at) VALUES($1,$2,$3,$4,$5,$6,$7,now()) RETURNING id,institution_id AS "institutionId",project_id AS "projectId",asset_id AS "assetId",status,scope,findings,opened_at AS "openedAt"',[b.institutionId,projectId,p.rows[0].asset_id,'open',b.scope||'Institutional diligence',b.findings||null,req.member.id]);
  return res.status(201).json(r.rows[0]);
 }
 const b=req.body||{}; if(!b.caseId||!statuses.includes(b.status))return res.status(400).json({error:'caseId and valid status are required'});
 const r=await db.query('UPDATE institutional_due_diligence SET status=$1,findings=COALESCE($2,findings),completed_at=CASE WHEN $1 IN (\'completed\',\'closed\') THEN now() ELSE completed_at END WHERE id=$3 AND project_id=$4 RETURNING id,status,findings,completed_at AS "completedAt"',[b.status,b.findings||null,b.caseId,projectId]);
 if(!r.rows.length)return res.status(404).json({error:'Diligence case not found'});
 if(b.decision){if(!decisions.includes(b.decision))return res.status(400).json({error:'Invalid decision'});await db.query('INSERT INTO submission_reviews(submission_id,reviewer,decision,notes) SELECT id,$1,$2,$3 FROM institutional_submissions WHERE project_id=$4 ORDER BY created_at DESC LIMIT 1',[req.member.id,b.decision,b.notes||null,projectId]);}
 res.json(r.rows[0]);
}