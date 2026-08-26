import { db } from 'hatchable';
export const access='admin';
export const methods=['GET','POST'];
export default async function(req,res){
 if(req.method==='GET'){
  const organizations=(await db.query("SELECT id,name,slug,organization_type,status FROM gis_organizations ORDER BY name")).rows;
  const members=(await db.query("SELECT id,organization_id,member_id,role,status FROM gis_organization_members ORDER BY organization_id,member_id")).rows;
  const positions=(await db.query("SELECT id,organization_id,position_code,position_name,dashboard_key,status FROM gis_organization_positions ORDER BY organization_id,position_name")).rows;
  return res.json({phase:'388.15',organizations,members,positions});
 }
 const b=req.body||{}, action=b.action;
 if(action==='CREATE_ORGANIZATION'){
  if(!b.name||!b.slug)return res.status(400).json({error:'name and slug are required'});
  const r=await db.query("INSERT INTO gis_organizations(name,slug,organization_type,status) VALUES($1,$2,$3,'ACTIVE') ON CONFLICT(slug) DO UPDATE SET name=EXCLUDED.name RETURNING id,name,slug,organization_type,status",[b.name,b.slug,b.organization_type||'ENTERPRISE']);
  const org=r.rows[0];
  await db.query("INSERT INTO gis_organization_audit(organization_id,member_id,action,metadata) VALUES($1,$2,'ORGANIZATION_PROVISIONED',$3)",[org.id,req.member.id,JSON.stringify({phase:'388.15'})]);
  return res.json({phase:'388.15',action,organization:org,idempotent:true});
 }
 if(action==='INVITE_MEMBER'){
  if(!b.organization_id||!b.member_id)return res.status(400).json({error:'organization_id and member_id are required'});
  const r=await db.query("INSERT INTO gis_organization_members(organization_id,member_id,role,status) VALUES($1,$2,$3,'ACTIVE') ON CONFLICT(organization_id,member_id) DO UPDATE SET role=EXCLUDED.role,status='ACTIVE' RETURNING id,organization_id,member_id,role,status",[b.organization_id,b.member_id,b.role||'USER']);
  await db.query("INSERT INTO gis_organization_audit(organization_id,member_id,action,metadata) VALUES($1,$2,'MEMBER_PROVISIONED',$3)",[b.organization_id,req.member.id,JSON.stringify({target_member_id:b.member_id,role:b.role||'USER',phase:'388.15'})]);
  return res.json({phase:'388.15',action,member:r.rows[0],idempotent:true});
 }
 if(action==='ASSIGN_POSITION'){
  if(!b.organization_id||!b.position_code||!b.position_name||!b.dashboard_key)return res.status(400).json({error:'organization_id, position_code, position_name and dashboard_key are required'});
  const p=await db.query("INSERT INTO gis_organization_positions(organization_id,position_code,position_name,dashboard_key,status) VALUES($1,$2,$3,$4,'ACTIVE') ON CONFLICT(organization_id,position_code) DO UPDATE SET position_name=EXCLUDED.position_name,dashboard_key=EXCLUDED.dashboard_key,status='ACTIVE' RETURNING id,organization_id,position_code,position_name,dashboard_key,status",[b.organization_id,b.position_code,b.position_name,b.dashboard_key]);
  await db.query("INSERT INTO gis_organization_dashboards(organization_id,dashboard_key,position_code) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",[b.organization_id,b.dashboard_key,b.position_code]);
  await db.query("INSERT INTO gis_organization_audit(organization_id,member_id,action,metadata) VALUES($1,$2,'POSITION_PROVISIONED',$3)",[b.organization_id,req.member.id,JSON.stringify({position_code:b.position_code,dashboard_key:b.dashboard_key,phase:'388.15'})]);
  return res.json({phase:'388.15',action,position:p.rows[0],dashboard_key:b.dashboard_key,idempotent:true});
 }
 return res.status(400).json({error:'unsupported_action'});
}