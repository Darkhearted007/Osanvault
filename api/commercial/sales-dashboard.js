import { db } from 'hatchable';
export const access='admin'; export const methods=['GET'];
export default async function(req,res){
 const metrics=(await db.query("SELECT COUNT(*)::int AS leads,COUNT(*) FILTER (WHERE sales_stage='QUALIFIED')::int AS qualified,COUNT(*) FILTER (WHERE sales_stage='PILOT')::int AS active_pilots,COUNT(*) FILTER (WHERE sales_stage='PAYING')::int AS paying_customers,COUNT(*) FILTER (WHERE sales_stage='EXPANDED')::int AS expanded_customers,COALESCE(SUM(expected_contract_value),0) AS pipeline_value,COALESCE(SUM(expected_contract_value) FILTER (WHERE sales_stage IN ('PAYING','EXPANDED')),0) AS contracted_value FROM commercial_workspace_requests")).rows[0];
 const stages=(await db.query("SELECT sales_stage,COUNT(*)::int AS count,COALESCE(SUM(expected_contract_value),0) AS value FROM commercial_workspace_requests GROUP BY sales_stage ORDER BY sales_stage")).rows;
 const pilots=(await db.query("SELECT id,organization,organization_type,plan,sales_stage,pilot_status,pilot_start_at,pilot_end_at,expected_contract_value,sales_owner,next_action,expected_close_date FROM commercial_workspace_requests WHERE pilot_status<>'NOT_STARTED' OR sales_stage IN ('PILOT','PAYING','EXPANDED') ORDER BY created_at DESC")).rows;
 const recent=(await db.query("SELECT id,organization,organization_type,plan,sales_stage,verification_status,expected_contract_value,sales_owner,next_action,expected_close_date,created_at FROM commercial_workspace_requests ORDER BY created_at DESC LIMIT 50")).rows;
 res.json({metrics,stages,pilots,recent});
}