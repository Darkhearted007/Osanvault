import { db } from 'hatchable';
export const access='admin';
export const methods=['GET'];
export default async function(req,res){
 const w=(await db.query("SELECT COUNT(*)::int n FROM gis_phase372_boundary_features WHERE boundary_level='WARD' AND geometry_valid=true AND geometry_empty=false")).rows[0].n;
 const ex=(await db.query("SELECT COUNT(*)::int n FROM gis_phase3865_review_queue WHERE status='OPEN'")).rows[0].n;
 const dec=(await db.query("SELECT COUNT(*)::int n FROM gis_phase3865_review_queue WHERE status IN ('APPROVED','REJECTED','QUARANTINED','DEFERRED')")).rows[0].n;
 const dup=(await db.query("SELECT COUNT(*)::int n FROM (SELECT boundary_id FROM gis_phase372_boundary_features WHERE boundary_level='WARD' GROUP BY boundary_id HAVING COUNT(*)>1)x")).rows[0].n;
 const ready=w===5872&&ex===0&&dec===56&&dup===0;
 res.json({phase:387,certificationGate:ready?'READY':'BLOCKED',wardGeometryValid:w,openExceptions:ex,decidedExceptions:dec,duplicateWardGroups:dup,certificationEnabled:false});
}