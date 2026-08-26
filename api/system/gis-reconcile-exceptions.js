import { db } from 'hatchable';
export const access='admin'; export const methods=['POST'];
export default async function(req,res){
  const crosswalkVersion='GRID3-current';
  const run=await db.query("INSERT INTO gis_reconciliation_runs(run_name,method,candidate_count,status,started_at,crosswalk_version) VALUES('Phase 389.73 primary cross-validation','fail-closed-authority-gate',30,'OPEN',now(),$1) RETURNING id",[crosswalkVersion]);
  const id=run.rows[0].id;
  const c=await db.query("SELECT count(*)::int AS n FROM gis_exception_candidate_matches");
  const candidateCount=c.rows[0].n;
  const v=await db.query("SELECT count(*)::int AS n FROM gis_exception_candidate_matches m WHERE EXISTS (SELECT 1 FROM gis_ward_evidence_matches e WHERE e.candidate_match_id=m.id AND COALESCE(e.verification_status,'')='VERIFIED')");
  const verified=v.rows[0].n;
  const unresolved=Math.max(candidateCount-verified,0);
  await db.query("UPDATE gis_reconciliation_runs SET candidate_count=$1,verified_count=$2,unresolved_count=$3,status='COMPLETE_WITH_HOLDS',completed_at=now() WHERE id=$4",[candidateCount,verified,unresolved,id]);
  res.json({run_id:id,candidate_count:candidateCount,verified_count:verified,unresolved_count:unresolved,status:'COMPLETE_WITH_HOLDS',policy:'No candidate is promoted without independently verified ward-level authority evidence.'});
}