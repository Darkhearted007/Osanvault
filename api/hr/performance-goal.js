import { db } from 'hatchable';
export const access = "admin";
export const methods = ["POST"];
export default async function(req,res){const {person_id,cycle_id,title,description,target,weight}=req.body||{};if(!person_id||!title)return res.status(400).json({ok:false,error:'person_id and title are required'});const {rows}=await db.query(`INSERT INTO performance_goals(person_id,cycle_id,title,description,target,weight) VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,[person_id,cycle_id||null,title,description||null,target??null,Number(weight||100)]);res.status(201).json({ok:true,goal:rows[0]})}