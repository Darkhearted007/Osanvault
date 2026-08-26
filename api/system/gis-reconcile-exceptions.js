import { db } from 'hatchable';
export const access='admin'; export const methods=['POST'];
export default async function(req,res){
 const candidates=(await db.query("SELECT id,exception_id,candidate_source,state_name,lga_name,candidate_area_code,confidence,status,evidence_reference FROM gis_exception_candidate_matches WHERE status='CANDIDATE_ONLY' ORDER BY created_at")).rows;
 const run=(await db.query("INSERT INTO gis_reconciliation_runs(run_name,method,candidate_count,status,started_at) VALUES($1,$2,$3,$4,now()) RETURNING id,run_name,method,candidate_count,verified_count,unresolved_count,status")).rows[0];
 let unresolved=0; for(const c of candidates){unresolved++; await db.query("INSERT INTO gis_reconciliation_results(run_id,exception_id,candidate_id,decision,authority_status,rationale) VALUES($1,$2,$3,$4,$5,$6)",[run.id,c.exception_id,c.id,'HOLD','PRIMARY_AUTHORITY_GAP','GRID3 exact administrative code candidate exists, but no independently verified INEC ward-level evidence record or geometry is present; candidate must not be promoted.']);}
 await db.query("UPDATE gis_reconciliation_runs SET unresolved_count=$1,status=$2,completed_at=now() WHERE id=$3",[unresolved,'COMPLETE_WITH_HOLDS',run.id]);
 return res.json({run_id:run.id,candidate_count:candidates.length,verified_count:0,unresolved_count:unresolved,status:'COMPLETE_WITH_HOLDS',policy:'No candidate is promoted without independently verified ward-level authority evidence.'});
}