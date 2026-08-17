import { db } from 'hatchable';
export const access='member';
export const methods=['GET'];
export default async function(req,res){
  const r=await db.query('SELECT e.id,e.submission_id AS "submissionId",e.event_type AS "eventType",e.actor,e.details,e.created_at AS "createdAt" FROM submission_events e JOIN institutional_submissions s ON s.id=e.submission_id WHERE s.project_id=$1 ORDER BY e.created_at DESC',[req.params.id]);
  res.json(r.rows);
}