import { db } from 'hatchable';
export const access='admin'; export const methods=['GET'];
export default async function(req,res){
  const open=(await db.query(`SELECT q.id,q.category,q.status,q.state_code,q.source_feature_id,s.area_code source_area_code,s.area_name source_lga_name,s.parent_area_code source_state_code
    FROM gis_current_exception_queue q
    JOIN gis_spatial_features s ON s.id=q.source_feature_id
    WHERE q.status='OPEN' ORDER BY q.created_at,q.id`)).rows;
  const hist=(await db.query(`SELECT exception_id,source_feature_id,candidate_area_code,source_lineage_status,retirement_status,certification_scope
    FROM gis_exception_candidate_matches
    WHERE source_lineage_status='HISTORICAL_IDENTITY_LOST'
       OR retirement_status='ARCHIVED_UNRESOLVED'
       OR certification_scope='HISTORICAL_ARCHIVE'`)).rows;
  const blocked=new Set(hist.flatMap(x=>[String(x.exception_id||''),String(x.source_feature_id||'')]).filter(Boolean));
  const eligible=open.filter(x=>!blocked.has(String(x.id))&&!blocked.has(String(x.source_feature_id)));
  res.json({
    decision:eligible.length?'CURRENT_CANDIDATE_DISCOVERY_AVAILABLE':'NO_NON_HISTORICAL_CURRENT_CANDIDATE_SOURCE',
    open_exception_count:open.length,
    historical_terminal_count:hist.length,
    eligible_current_exception_count:eligible.length,
    eligible_current_exceptions:eligible,
    policy:'Historical exclusion is keyed to the same exception or source feature, not merely the LGA area code. Ward identity still requires explicit authoritative INEC evidence.'
  });
}