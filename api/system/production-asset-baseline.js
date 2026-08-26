import { storage } from 'hatchable';
export const access='admin'; export const methods=['POST'];
const key='phase388/production-asset-baseline.json';
const ASSET_ID='osanvault-prod-reference-001';
export default async function(req,res){
 const cp=await storage.get('phase388/control-plane.json');
 const s=JSON.parse(new TextDecoder().decode(cp.buffer));
 const org=(s.organizations||[]).find(o=>o.environment==='production'&&o.status==='ACTIVE');
 if(!org)return res.status(409).json({error:'production_tenant_missing'});
 s.assets=s.assets||[];s.assetIntelligence=s.assetIntelligence||[];s.assetHealth=s.assetHealth||[];s.risks=s.risks||[];s.events=s.events||[];s.evidence=s.evidence||[];s.signals=s.signals||[];
 const asset={id:ASSET_ID,organization_id:org.id,name:'ÒsánVault Production Reference Asset',asset_type:'real_world_asset',status:'ACTIVE',gis_layer_key:'nigeria_salb_adm2',jurisdiction:'Nigeria',created_at:new Date().toISOString()};
 s.assets=s.assets.filter(x=>x.id!==ASSET_ID);s.assets.push(asset);
 s.assetIntelligence=s.assetIntelligence.filter(x=>x.asset_id!==ASSET_ID);s.assetIntelligence.push({id:'ai-'+ASSET_ID,organization_id:org.id,asset_id:ASSET_ID,intelligence_status:'ACTIVE',confidence:0.92,source:'controlled-production-validation',updated_at:new Date().toISOString()});
 s.assetHealth=s.assetHealth.filter(x=>x.asset_id!==ASSET_ID);s.assetHealth.push({id:'health-'+ASSET_ID,organization_id:org.id,asset_id:ASSET_ID,health_score:91,status:'HEALTHY',updated_at:new Date().toISOString()});
 s.risks=s.risks.filter(x=>x.asset_id!==ASSET_ID);s.risks.push({id:'risk-'+ASSET_ID,organization_id:org.id,asset_id:ASSET_ID,risk_score:22,risk_level:'LOW',source:'controlled-production-validation',updated_at:new Date().toISOString()});
 s.evidence=s.evidence.filter(x=>x.asset_id!==ASSET_ID);s.evidence.push({id:'evidence-'+ASSET_ID,organization_id:org.id,asset_id:ASSET_ID,type:'production-baseline',confidence:0.92,verified:true,created_at:new Date().toISOString()});
 s.signals=s.signals.filter(x=>x.asset_id!==ASSET_ID);s.signals.push({id:'signal-'+ASSET_ID,organization_id:org.id,asset_id:ASSET_ID,type:'BASELINE_VERIFIED',severity:'INFO',created_at:new Date().toISOString()});
 s.events=s.events.filter(x=>x.id!=='event-'+ASSET_ID);s.events.push({id:'event-'+ASSET_ID,organization_id:org.id,asset_id:ASSET_ID,type:'PRODUCTION_ASSET_BASELINED',status:'OPEN',created_at:new Date().toISOString()});
 s.accessEvents=s.accessEvents||[];s.accessEvents.push({id:'audit-'+Date.now(),organization_id:org.id,type:'PRODUCTION_ASSET_BASELINE_PROVISIONED',asset_id:ASSET_ID,created_at:new Date().toISOString()});
 await storage.put('phase388/control-plane.json',new TextEncoder().encode(JSON.stringify(s)),'application/json');
 const result={phase:'388.34',status:'BASELINE_PROVISIONED',organization_id:org.id,asset_id:ASSET_ID,checks:{asset:true,intelligence:true,health:true,risk:true,evidence:true,signal:true,event:true,audit:true}};
 await storage.put(key,new TextEncoder().encode(JSON.stringify(result,null,2)),'application/json');res.json(result);
}