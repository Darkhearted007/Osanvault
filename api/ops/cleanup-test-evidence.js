import { db } from 'hatchable';
export const access='admin';
export const methods=['POST'];
export default async function(req,res){
 const r=await db.query(`DELETE FROM economic_evidence_vault WHERE id=$1 AND source_type='system_generated' RETURNING id`,['54d24dda-9648-4c59-8d6a-f62eddb4d101']);
 res.json({ok:true,deleted:r.rows.length,publicExposure:false});
}