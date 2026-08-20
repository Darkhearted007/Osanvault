import { db } from 'hatchable';
export const access='admin';
export const methods=['POST'];
export default async function(req,res){
 const candidates=await db.query(`SELECT id,display_name,data_environment,owner_id FROM economic_onboarding_profiles WHERE lower(display_name) LIKE 'ov-19.11 controlled test business%' OR lower(display_name) LIKE 'ov20 internal onboarding test%' ORDER BY display_name`);
 const quarantined=[];
 for(const row of candidates.rows){
   if(row.data_environment!=='test'){
     await db.query(`UPDATE economic_onboarding_profiles SET data_environment='test',quarantine_reason=$1,quarantined_at=now() WHERE id=$2`,['Synthetic validation artifact quarantined during OV-21.3R integrity sweep.',row.id]);
   }
   quarantined.push({id:row.id,name:row.display_name,environment:'test'});
 }
 res.json({ok:true,quarantinedCount:quarantined.length,quarantined,productionExposure:false});
}