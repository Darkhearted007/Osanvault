import { readState, audit, writeState, memberFor, orgFor } from '../../lib/phase388-control-plane.js';
export const access='member';
export const methods=['GET'];
const map={executive:'CEO',operations:'OPERATIONS_MANAGER',analyst:'INTELLIGENCE_ANALYST',regulator:'REGULATOR',investor:'INVESTOR'};
export default async function(req,res){
 const orgId=req.query?.organization_id, dashboard=(req.query?.dashboard||'').toLowerCase();
 if(!orgId||!dashboard)return res.status(400).json({error:'organization_id and dashboard are required'});
 const s=await readState(), org=orgFor(s,orgId), member=memberFor(s,orgId,req.member.id);
 if(!org)return res.status(404).json({error:'organization_not_found'});
 if(!member||member.status!=='ACTIVE')return res.status(403).json({error:'organization_access_denied'});
 const positions=s.positions.filter(p=>p.organization_id===orgId&&p.status==='ACTIVE');
 const position=positions.find(p=>p.position_code===member.position_code)||positions.find(p=>String(p.dashboard_key).toLowerCase()===dashboard);
 if(!position)return res.status(403).json({error:'position_not_authorized'});
 if(String(position.dashboard_key).toLowerCase()!==dashboard)return res.status(403).json({error:'dashboard_not_authorized',authorized_dashboard:position.dashboard_key});
 audit(s,orgId,req.member.id,req.member.id,'WORKSPACE_AUTHORIZED',{dashboard,position_code:position.position_code}); await writeState(s);
 res.json({phase:'388.18',authorized:true,organization:{id:org.id,name:org.name},member:{id:member.member_id,role:member.role,status:member.status,position_code:member.position_code},position,dashboard,modules:dashboard==='executive'?['overview','risk','opportunities','reports']:dashboard==='operations'?['assets','alerts','risk','actions','reports']:dashboard==='analyst'?['evidence','signals','gis','risk','relationships','reports']:dashboard==='regulator'?['compliance','evidence','jurisdiction','risk','review_queue','audit','reports']:dashboard==='investor'?['portfolio','readiness','risk','evidence_confidence','opportunities','reports']:[]});
}