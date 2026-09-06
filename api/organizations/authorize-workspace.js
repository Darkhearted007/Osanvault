import { db } from 'hatchable';
export const access='user';
export const methods=['GET'];
const modules={executive:['overview','risk','opportunities','reports'],operations:['assets','alerts','risk','actions','reports'],analyst:['evidence','signals','gis','risk','relationships','reports'],regulator:['compliance','evidence','jurisdiction','risk','review_queue','audit','reports'],investor:['portfolio','readiness','risk','evidence_confidence','opportunities','reports']};
export default async function(req,res){
 const orgId=String(req.query?.organization_id||''), dashboard=String(req.query?.dashboard||'').toLowerCase(), userId=String(req.user.id);
 if(!orgId||!dashboard)return res.status(400).json({error:'organization_id and dashboard are required'});
 const org=(await db.query("SELECT id,name,status FROM gis_organizations WHERE id=$1 AND status='ACTIVE'",[orgId])).rows[0];
 if(!org)return res.status(404).json({error:'organization_not_found'});
 const member=(await db.query("SELECT id,member_id,role,status FROM gis_organization_members WHERE organization_id=$1 AND member_id=$2 AND status='ACTIVE'",[orgId,userId])).rows[0];
 if(!member)return res.status(403).json({error:'organization_access_denied'});
 const positionCode=member.role==='ADMIN'?'CEO':null;
 const position=positionCode?(await db.query("SELECT id,position_code,position_name,dashboard_key,created_at FROM gis_organization_positions WHERE organization_id=$1 AND position_code=$2",[orgId,positionCode])).rows[0]:null;
 if(!position)return res.status(403).json({error:'position_not_authorized'});
 if(String(position.dashboard_key).toLowerCase()!==dashboard)return res.status(403).json({error:'dashboard_not_authorized',authorized_dashboard:position.dashboard_key});
 res.json({phase:'production-organization-workspace-auth',authorized:true,organization:{id:org.id,name:org.name},member:{id:member.member_id,role:member.role,status:member.status},position,dashboard,modules:modules[dashboard]||[]});
}