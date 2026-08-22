import { db } from 'hatchable';
export const access='member'; export const methods=['GET','POST'];
export default async function(req,res){
 const member=req.member;
 const person=await db.query(`SELECT id,full_name FROM people_records WHERE email=$1 AND person_type='employee' LIMIT 1`,[member.email]);
 if(!person.rows.length)return res.status(404).json({ok:false,error:'Employee profile not linked to this account'});
 const personId=person.rows[0].id;
 if(req.method==='GET'){const {rows}=await db.query(`SELECT id,request_type,title,details,status,reviewed_at,reviewer_note,created_at FROM employee_requests WHERE person_id=$1 ORDER BY created_at DESC`,[personId]);return res.json({ok:true,requests:rows});}
 const b=req.body||{}; if(!b.request_type||!b.title)return res.status(400).json({ok:false,error:'request_type and title are required'});
 const {rows}=await db.query(`INSERT INTO employee_requests(person_id,request_type,title,details) VALUES($1,$2,$3,$4) RETURNING *`,[personId,b.request_type,b.title,b.details||null]);res.status(201).json({ok:true,request:rows[0]});
}