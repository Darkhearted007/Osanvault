import { db } from 'hatchable';
export const access='admin';
export const methods=['GET'];
export default async function(req,res){
 const q=await db.query(`SELECT q.id,q.candidate_match_id,q.state_name,q.lga_name,q.candidate_area_code,q.source_lineage_status,q.recovery_status,q.required_identity_fields,q.recovered_identity,q.blocker,c.status AS candidate_status,c.evidence_reference,c.created_at FROM gis_historical_candidate_recovery_queue q JOIN gis_exception_candidate_matches c ON c.id=q.candidate_match_id ORDER BY q.state_name,q.lga_name`);
 const summary=(await db.query(`SELECT recovery_status,count(*)::int AS count FROM gis_historical_candidate_recovery_queue GROUP BY recovery_status ORDER BY recovery_status`)).rows;
 return res.json({phase:'391.50',count:q.rows.length,summary,items:q.rows,policy:'Historical recovery is fail-closed. No candidate status or identity is promoted without authoritative source-level lineage and qualifying evidence.'});
}