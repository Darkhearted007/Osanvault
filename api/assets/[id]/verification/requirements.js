import { db } from 'hatchable';
import { authorizeTenant, tenantError } from 'lib/tenantAuthority.js';
export const access='admin';
export const methods=['POST'];
export default async function(req,res){
  const assetId=String(req.params?.id||'').trim();const caseId=req.body?.caseId;const requirements=req.body?.requirements;
  if(!caseId||!Array.isArray(requirements)||!requirements.length)return res.status(400).json({error:'caseId and requirements are required'});
  const scope=await db.query('SELECT vc.id,vc.asset_id,g.organization_id FROM verification_cases vc JOIN gis_organization_assets g ON g.asset_id=vc.asset_id WHERE vc.id=$1 AND vc.asset_id=$2 LIMIT 1',[caseId,assetId]);
  if(!scope.rows.length)return res.status(404).json({error:'verification_case_not_found'});
  const tenant=await authorizeTenant(req,scope.rows[0].organization_id,'asset:write');if(!tenant.allowed)return tenantError(res,tenant);
  const created=[];for(const r of requirements){if(!r.code||!r.title)continue;const row=await db.query('INSERT INTO verification_requirements (case_id,requirement_code,title,description,required,status) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id,requirement_code AS "requirementCode",title,status',[caseId,r.code,r.title,r.description||null,r.required!==false,'pending']);created.push(row.rows[0]);}
  res.status(201).json(created);
}