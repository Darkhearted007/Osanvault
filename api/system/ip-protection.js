import { storage } from 'hatchable';
export const access='public'; export const methods=['GET'];
const records=[
 {title:'ÒsánVault Africa — Intellectual Property Notice',type:'Copyright',status:'Protected',owner:'OSANVAULT AFRICA LTD',scope:'Software, source code, UI/UX, documentation, databases, schemas, workflows, architecture, branding and original content created for ÒsánVault Africa.',year:2026},
 {title:'ÒsánVault / OsanVault Africa',type:'Trademark',status:'Claimed / registration subject to formal filing',owner:'OSANVAULT AFRICA LTD',scope:'Name, word marks, logos, distinctive brand identifiers and associated goodwill.'},
 {title:'Industrial / Real-World Asset Intelligence Architecture',type:'Proprietary Know-How',status:'Confidential',owner:'OSANVAULT AFRICA LTD',scope:'Original intelligence workflows, control-plane architecture, evidence/provenance workflows, governance logic and implementation methods, excluding third-party materials.'}
];
export default async function(req,res){
 const notice="This notice records the company’s intended IP position. It is not a government registration or legal opinion. Third-party open-source software, provider data, public datasets and licensed materials remain subject to their own licences and terms.";
 const key='legal/ip-registry.json';
 await storage.put(key,new TextEncoder().encode(JSON.stringify({schema_version:1,company:'OSANVAULT AFRICA LTD',updated_at:new Date().toISOString(),records,notice,thirdPartyRule:'No ownership is asserted over third-party datasets, APIs, libraries, trademarks or provider content.'})), 'application/json');
 res.json({company:'OSANVAULT AFRICA LTD',storage_key:key,notice,records,thirdPartyRule:'No ownership is asserted over third-party datasets, APIs, libraries, trademarks or provider content.'});
}