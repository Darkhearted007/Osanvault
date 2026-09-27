import { db } from 'hatchable';

export async function authorizeGraphNode(req, organizationId, type, nodeId) {
  const t=String(type||'').toLowerCase();
  if(!organizationId||!nodeId) return {allowed:false,status:400,error:'organization_id and node id are required'};
  const memberId=req.member?.id;
  if(!memberId) return {allowed:false,status:401,error:'authentication_required'};
  const membership=await db.query("SELECT 1 FROM gis_organization_members WHERE organization_id=$1 AND member_id=$2 AND status='ACTIVE' LIMIT 1",[organizationId,memberId]);
  if(!membership.rows.length) return {allowed:false,status:403,error:'organization_access_denied'};
  if(t==='asset'){
    const r=await db.query('SELECT 1 FROM gis_organization_assets WHERE organization_id=$1 AND asset_id=$2 LIMIT 1',[organizationId,nodeId]);
    return r.rows.length?{allowed:true}:{allowed:false,status:404,error:'graph_asset_not_found'};
  }
  if(t==='project'){
    const r=await db.query('SELECT 1 FROM projects WHERE id=$1 AND organization_id=$2 LIMIT 1',[nodeId,organizationId]);
    return r.rows.length?{allowed:true}:{allowed:false,status:404,error:'graph_project_not_found'};
  }
  if(t==='entity'){
    const r=await db.query('SELECT 1 FROM economic_entities WHERE id=$1 AND created_by=$2 LIMIT 1',[nodeId,memberId]);
    return r.rows.length?{allowed:true}:{allowed:false,status:404,error:'graph_entity_not_found'};
  }
  if(t==='institution'){
    const r=await db.query("SELECT 1 FROM institution_members WHERE institution_id=$1 AND member_id=$2 AND status='active' LIMIT 1",[nodeId,memberId]);
    return r.rows.length?{allowed:true}:{allowed:false,status:404,error:'graph_institution_not_found'};
  }
  return {allowed:false,status:400,error:'Unsupported graph node type'};
}

export function graphTenantError(res,a){ return res.status(a.status||403).json({error:a.error||'graph_access_denied'}); }