import { db } from 'hatchable';
export const access='admin'; export const methods=['GET'];
export default async function(req,res){
 const [plans,subs,inv,ent,tickets,orgs]=await Promise.all([
  db.query("SELECT plan_key,name,COUNT(*) OVER()::int AS active_plan_count FROM commercial_plans WHERE active=true AND regulated_enabled=false ORDER BY plan_key"),
  db.query("SELECT status,COUNT(*)::int AS count FROM commercial_subscriptions GROUP BY status ORDER BY status"),
  db.query("SELECT status,COUNT(*)::int AS count,COALESCE(SUM(amount_minor),0)::text AS amount_minor FROM commercial_invoices GROUP BY status ORDER BY status"),
  db.query("SELECT plan_key,COUNT(*)::int AS count FROM commercial_entitlements WHERE enabled=true GROUP BY plan_key ORDER BY plan_key"),
  db.query("SELECT status,priority,COUNT(*)::int AS count FROM support_tickets GROUP BY status,priority ORDER BY status,priority"),
  db.query("SELECT organization_type,status,COUNT(*)::int AS count FROM gis_organizations GROUP BY organization_type,status ORDER BY organization_type,status")
 ]);
 const result={phase:'389.14',generated_at:new Date().toISOString(),plans:plans.rows,subscriptions:subs.rows,invoices:inv.rows,entitlements:ent.rows,support:tickets.rows,organizations:orgs.rows,regulated_features_enabled:false,payment_collection_enabled:false};
 res.json(result);
}