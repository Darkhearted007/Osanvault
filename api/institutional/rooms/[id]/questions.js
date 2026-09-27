import { db } from 'hatchable';
import { authorizeTenant, tenantError } from 'lib/tenantAuthority.js';
export const access='member'; export const methods=['POST','PUT'];
export default async function(req,res){
 const room=await db.query('SELECT d.id,oa.organization_id AS "organizationId" FROM institutional_data_rooms d JOIN gis_organization_assets oa ON oa.asset_id=d.asset_id WHERE d.id=$1',[req.params.id]);
 if(!room.rows.length)return res.status(404).json({error:'Data room not found'});
 const tenant=await authorizeTenant(req,room.rows[0].organizationId,'capital:write'); if(!tenant.allowed)return tenantError(res,tenant);
 const b=req.body||{};
 if(req.method==='POST'){
  if(!b.question)return res.status(400).json({error:'question is required'});
  const r=await db.query('INSERT INTO data_room_questions(room_id,question,asked_by) VALUES($1,$2,$3) RETURNING id,question,answer,status,asked_by AS "askedBy",created_at AS "createdAt"',[req.params.id,b.question,req.member.id]);
  await db.query('INSERT INTO data_room_audit(room_id,action,actor_id,metadata) VALUES($1,$2,$3,$4)',[req.params.id,'QUESTION_CREATED',req.member.id,JSON.stringify({questionId:r.rows[0].id})]);
  return res.status(201).json(r.rows[0]);
 }
 if(!b.questionId||typeof b.answer!=='string')return res.status(400).json({error:'questionId and answer are required'});
 const r=await db.query("UPDATE data_room_questions SET answer=$1,status='answered',answered_by=$2,answered_at=now() WHERE id=$3 AND room_id=$4 RETURNING id,question,answer,status,answered_by AS \"answeredBy\",answered_at AS \"answeredAt\"",[b.answer,req.member.id,b.questionId,req.params.id]);
 if(!r.rows.length)return res.status(404).json({error:'Question not found'});
 await db.query('INSERT INTO data_room_audit(room_id,action,actor_id,metadata) VALUES($1,$2,$3,$4)',[req.params.id,'QUESTION_ANSWERED',req.member.id,JSON.stringify({questionId:b.questionId})]);
 res.json(r.rows[0]);
}