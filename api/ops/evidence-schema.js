import { db } from 'hatchable';
export const access='member';
export const methods=['GET'];
export default async function(req,res){
 const r=await db.query(`SELECT current_schema() AS schema_name, table_schema,table_name,column_name,data_type FROM information_schema.columns WHERE table_name='economic_evidence_vault' ORDER BY table_schema,ordinal_position`);
 res.json({ok:true,columns:r.rows,publicExposure:false});
}