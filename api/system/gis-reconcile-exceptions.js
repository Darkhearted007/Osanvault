import { db } from 'hatchable';
export const access='admin'; export const methods=['POST'];
export default async function(req,res){
  const crosswalkVersion='GRID3-current';
  const run=await db.query("INSERT INTO gis_reconciliation_runs(run_name,method,candidate_count,status,started_at,crosswalk_version) VALUES('Phase 389.74 authoritative evidence reconciliation','fail-closed-authority-gate',0,'OPEN',now(),$1) RETURNING id",[crosswalkVersion]);
  const id=run.rows[0].id;
  const c=await db.query("SELECT count(*)::int AS n FROM gis_exception_candidate_matches WHERE status='CANDIDATE_ONLY'");
  const candidateCount=c.rows[0].n;
  const e=await db.query("SELECT count(*)::int AS n FROM gis_ward_evidence_matches");
  const evidenceRows=e.rows[0].n;
  const verified=0;
  const unresolved=candidateCount;
  await db.query("UPDATE gis_reconciliation_runs SET candidate_count=$1,verified_count=$2,unresolved_count=$3,status='COMPLETE_WITH_HOLDS',completed_at=now() WHERE id=$4",[candidateCount,verified,unresolved,id]);
  res.json({run_id:id,candidate_count:candidateCount,evidence_match_rows:evidenceRows,verified_count:verified,unresolved_count:unresolved,status:'COMPLETE_WITH_HOLDS',policy:'No candidate is promoted without independently verified ward-level authority evidence.'});
}