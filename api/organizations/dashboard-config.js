import { db } from 'hatchable';
export const access='member';
export const methods=['POST'];
export default async function(req,res){
 const b=req.body||{};
 if(!b.organizationId||!b.dashboardKey)return res.status(400).json({error:'organizationId and dashboardKey are required'});
 const tx=await db.transaction([
  {sql:"SELECT set_config('app.current_member_id',$1,true)",params:[req.member.id]},
  {sql:"SELECT role FROM gis_organization_members WHERE organization_id=$1 AND member_id=$2 AND status='ACTIVE'",params:[b.organizationId,req.member.id]}
 ]);
 const role=tx.results[1].rows[0]?.role;
 if(!role)return res.status(403).json({error:'Organization access denied'});
 if(!['OWNER','ADMIN'].includes(role))return res.status(403).json({error:'Admin role required'});
 const r=await db.query("INSERT INTO gis_organization_dashboards(organization_id,dashboard_key,position_code,config) VALUES($1,$2,$3,$4) ON CONFLICT(organization_id,dashboard_key,position_code) DO UPDATE SET config=EXCLUDED.config,updated_at=now() RETURNING id,dashboard_key AS \"dashboardKey\",position_code AS \"positionCode\",config",[b.organizationId,b.dashboardKey,b.positionCode||null,JSON.stringify(b.config||{})]);
 return res.json({dashboard:r.rows[0]});
}