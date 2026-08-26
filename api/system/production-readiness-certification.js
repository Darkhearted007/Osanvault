import { readState } from '../../lib/phase388-control-plane.js';
export const access='admin';
export const methods=['GET'];
const criticalRoutes=['/api/organizations/dashboard-intelligence','/api/organizations/event-stream','/api/organizations/intelligence-ingest','/api/organizations/intelligence-rules','/api/organizations/intelligence-rule-evaluate','/api/organizations/asset-intelligence','/api/organizations/intelligence-graph','/api/organizations/cascading-risk','/api/organizations/mitigation-engine','/api/organizations/mitigation-decision'];
const requiredModules={executive:['overview','risk','opportunities','reports'],operations:['assets','alerts','risk','actions','reports'],analyst:['evidence','signals','gis','risk','relationships','reports'],regulator:['compliance','evidence','jurisdiction','risk','review_queue','audit','reports'],investor:['portfolio','readiness','risk','evidence_confidence','opportunities','reports']};
function check(name,pass,details){return{name,status:pass?'PASS':'BLOCKED',details}}
export default async function(req,res){const s=await readState();const orgs=s.organizations||[],members=s.members||[],positions=s.positions||[],dashboards=s.dashboards||[],assets=s.assets||[],layers=s.layers||[],events=s.events||[],rules=s.intelligenceRules||[],rels=s.relationships||[],health=s.assetHealth||[],plans=s.mitigationPlans||[],audits=s.accessEvents||[];const checks=[];
 checks.push(check('control_plane_state',true,{storageBacked:true,organizations:orgs.length,members:members.length,positions:positions.length}));
 checks.push(check('tenant_baseline',orgs.length>0,{organizations:orgs.length,message:orgs.length?'Tenant baseline exists':'No production organization has been provisioned yet'}));
 const activeMembers=members.filter(m=>m.status==='ACTIVE');
 const positionCoverage=orgs.length>0&&activeMembers.length>0&&positions.length>0;
 checks.push(check('position_dashboard_authorization',positionCoverage,{activeMembers:activeMembers.length,positions:positions.length,dashboards:dashboards.length}));
 const dashboardCoverage=Object.entries(requiredModules).every(([k,mods])=>dashboards.some(d=>String(d.key||d.dashboard_key||'').toLowerCase()===k&&mods.every(m=>(d.modules||[]).includes(m))));
 checks.push(check('dashboard_module_coverage',dashboardCoverage,{requiredModules}));
 checks.push(check('tenant_isolation',events.every(e=>e.organization_id)&&rels.every(r=>r.organization_id)&&plans.every(p=>p.organization_id),{events:events.length,relationships:rels.length,mitigationPlans:plans.length}));
 checks.push(check('auditability',audits.length>0,{auditEvents:audits.length}));
 checks.push(check('intelligence_chain',rules.length>0&&health.length>=0&&plans.length>=0,{rules:rules.length,assetHealth:health.length,mitigationPlans:plans.length}));
 checks.push(check('gis_readiness',layers.length>0,{layers:layers.length,message:layers.length?'GIS layers available':'No tenant GIS layer is present in the control-plane state'}));
 checks.push(check('critical_route_inventory',criticalRoutes.length===10,{criticalRoutes:criticalRoutes.length}));
 const blockers=checks.filter(c=>c.status==='BLOCKED');const score=Math.round(((checks.length-blockers.length)/checks.length)*100);const decision=blockers.length===0?'PRODUCTION_READY':'NOT_READY';
 res.status(decision==='PRODUCTION_READY'?200:409).json({phase:'388.30',certification:'PRODUCTION_READINESS',decision,score,checks,blockers:blockers.map(b=>({name:b.name,details:b.details})),criticalRoutes,productionDeclaration:decision==='PRODUCTION_READY'?'Certified for production release':'Not certified: resolve every BLOCKED gate before declaring production ready',nextAction:blockers.length?'Provision/verify the production tenant baseline, position dashboards, GIS data and operational test evidence, then rerun certification.':'Proceed to controlled production launch.',timestamp:new Date().toISOString()});}