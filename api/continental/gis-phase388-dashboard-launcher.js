import { db } from 'hatchable';
export const access='member';
export const methods=['GET'];
export default async function(req,res){
 const member=req.member;
 const org=(await db.query("SELECT o.id,o.name,o.organization_type FROM gis_organizations o JOIN gis_organization_members m ON m.organization_id=o.id WHERE m.member_id=$1 ORDER BY o.name LIMIT 1",[member.id])).rows[0];
 if(!org)return res.status(404).json({error:'no_organization_workspace'});
 const position=(await db.query("SELECT id,position_name,dashboard_key FROM gis_organization_positions WHERE organization_id=$1 ORDER BY position_name LIMIT 1",[org.id])).rows[0];
 if(!position)return res.status(404).json({error:'no_position_dashboard'});
 const labels={executive:'Executive Command',operations:'Operations Control',analyst:'Intelligence Analyst',regulator:'Regulatory Oversight',investor:'Investment Intelligence'};
 const key=position.dashboard_key||'executive';
 const modules=[['overview','Portfolio Overview'],['assets','Authorized Assets'],['risk','Risk Intelligence'],['alerts','Active Alerts'],['gis','GIS Intelligence'],['reports','Reports & Recommendations']].map(([id,label])=>({id,label,value:'—',description:'Live tenant-scoped '+label.toLowerCase()}));
 res.json({phase:388.2,organization:org,position,dashboard:{key,label:labels[key]||key},modules,tenant_isolated:true});
}