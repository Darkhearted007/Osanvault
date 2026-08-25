export const access="admin";
export const methods=["POST"];
const ROOT='https://services9.arcgis.com/weJ1QsnbMYJlCHdG/arcgis/rest/services/';
export default async function(req,res){const names=['NGA_Operational_States','NGA_Operational_LGAs','NGA_Operational_Wards'];const out=[];for(const n of names){const u=ROOT+n+'/FeatureServer';try{const r=await fetch(u+'?f=pjson');const t=await r.text();out.push({name:n,url:u,status:r.status,body:t.slice(0,300)});}catch(e){out.push({name:n,url:u,error:e.message});}}return res.json({phase:374,probes:out,assertions:{lgaWardEnabled:false}})}