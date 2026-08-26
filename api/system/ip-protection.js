import { db } from 'hatchable';
export const access='public'; export const methods=['GET'];
export default async function(req,res){
 const records=[
  {title:'ÒsánVault Africa — Intellectual Property Notice',type:'Copyright',status:'Protected',owner:'OSANVAULT AFRICA LTD',scope:'Software, source code, UI/UX, documentation, databases, schemas, workflows, architecture, branding and original content created for ÒsánVault Africa.',year:2026},
  {title:'ÒsánVault / OsanVault Africa',type:'Trademark',status:'Claimed / registration subject to formal filing',owner:'OSANVAULT AFRICA LTD',scope:'Name, word marks, logos, distinctive brand identifiers and associated goodwill.'},
  {title:'Industrial / Real-World Asset Intelligence Architecture',type:'Proprietary Know-How',status:'Confidential',owner:'OSANVAULT AFRICA LTD',scope:'Original intelligence workflows, control-plane architecture, evidence/provenance workflows, governance logic and implementation methods, excluding third-party materials.'}
 ];
 let notice='This notice records the company\'s intended IP position. It is not a government registration or a legal opinion. Third-party open-source, provider data, public datasets and licensed materials remain subject to their own licences and terms.';
 try{await db.query(`CREATE TABLE IF NOT EXISTS osv_ip_registry (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),title text NOT NULL,type text NOT NULL,status text NOT NULL,owner text NOT NULL,scope text NOT NULL,year int,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(title,type))`);for(const r of records)await db.query(`INSERT INTO osv_ip_registry(title,type,status,owner,scope,year) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(title,type) DO UPDATE SET status=EXCLUDED.status,owner=EXCLUDED.owner,scope=EXCLUDED.scope,year=EXCLUDED.year`,[r.title,r.type,r.status,r.owner,r.scope,r.year||null]);}catch(e){return res.status(500).json({error:'ip_registry_unavailable',message:e.message})}
 res.json({company:'OSANVAULT AFRICA LTD',notice,records,thirdPartyRule:'No ownership is asserted over third-party datasets, APIs, libraries, trademarks or provider content.'});
}