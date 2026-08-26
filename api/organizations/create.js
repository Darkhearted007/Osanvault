import { db } from 'hatchable';
export const access='admin';
export const methods=['POST'];
export default async function(req,res){
 const b=req.body||{};
 if(!b.name||!b.slug||!b.organizationType)return res.status(400).json({error:'name, slug and organizationType are required'});
 const r=await db.query("INSERT INTO gis_organizations(name,slug,organization_type,created_by) VALUES($1,$2,$3,$4) RETURNING id,name,slug,organization_type AS \"organizationType\",status,dashboard_mode AS \"dashboardMode\"",[b.name,b.slug.toLowerCase(),b.organizationType,req.member.id]);
 await db.query("INSERT INTO gis_organization_members(organization_id,member_id,role) VALUES($1,$2,'OWNER') ON CONFLICT(organization_id,member_id) DO UPDATE SET role='OWNER',status='ACTIVE'",[r.rows[0].id,req.member.id]);
 return res.status(201).json(r.rows[0]);
}