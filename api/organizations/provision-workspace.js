import { db } from 'hatchable';
export const access='admin';
export const methods=['POST'];
const defaults={EXECUTIVE:'executive',OPERATIONS:'operations',ANALYST:'analyst',REGULATOR:'regulator',INVESTOR:'investor'};
export default async function(req,res){
 const b=req.body||{}; if(!b.organizationId)return res.status(400).json({error:'organizationId is required'});
 const org=(await db.query("SELECT id,name,organization_type,status FROM gis_organizations WHERE id=$1",[b.organizationId])).rows[0];
 if(!org)return res.status(404).json({error:'Organization not found'});
 const positions=Array.isArray(b.positions)&&b.positions.length?b.positions:Object.entries(defaults).map(([positionCode,dashboardKey])=>({positionCode,positionName:positionCode.charAt(0)+positionCode.slice(1).toLowerCase(),dashboardKey}));
 const created=[];
 for(const p of positions){if(!p.positionCode||!p.dashboardKey)continue; const r=await db.query("INSERT INTO gis_organization_positions(organization_id,position_code,position_name,dashboard_key) VALUES($1,$2,$3,$4) ON CONFLICT(organization_id,position_code) DO UPDATE SET position_name=EXCLUDED.position_name,dashboard_key=EXCLUDED.dashboard_key RETURNING id,position_code AS \"positionCode\",position_name AS \"positionName\",dashboard_key AS \"dashboardKey\"",[org.id,p.positionCode,p.positionName||p.positionCode,p.dashboardKey]); await db.query("INSERT INTO gis_organization_dashboards(organization_id,dashboard_key,position_code,config) VALUES($1,$2,$3,$4) ON CONFLICT(organization_id,dashboard_key,position_code) DO NOTHING",[org.id,p.dashboardKey,p.positionCode,JSON.stringify({organizationType:org.organization_type})]); created.push(r.rows[0]);}
 return res.json({phase:'387.8',organization:org,positions:created,workspaceProvisioned:true,tenantIsolated:true});
}