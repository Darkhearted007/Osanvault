import { db } from 'hatchable';
export const access='public';
export const methods=['GET'];

export default async function(req,res){
  const {rows}=await db.query(
    "SELECT module_key,name,customer_segments,value_proposition,revenue_model,maturity,regulatory_boundary,dependency_modules,display_order FROM continental_business_modules WHERE active=true ORDER BY display_order,module_key"
  );
  res.json({
    brand:'ÒsánVault Africa',
    portfolio_scope:'continental-business-architecture',
    principle:'Build around evidence, asset intelligence and institutional workflows; add country and sector depth without turning the platform into a regulated financial intermediary.',
    modules:rows
  });
}