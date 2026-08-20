import { db } from 'hatchable';
export const access='admin';
export const methods=['POST'];
export default async function(req,res){
 const r=await db.query(`UPDATE economic_onboarding_profiles SET data_environment='test' WHERE display_name IN ('OV20 Internal Onboarding Test','OV-19.11 Controlled Test Business') AND data_environment='production' RETURNING id,display_name,data_environment`);
 res.json({ok:true,quarantined:r.rows.length,records:r.rows});
}