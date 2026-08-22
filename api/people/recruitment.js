import { db } from 'hatchable';
export const access='admin'; export const methods=['GET','POST'];
export default async function(req,res){
 if(req.method==='GET'){
  const {rows}=await db.query(`SELECT c.id,c.source,c.application_date AS "applicationDate",c.screening_score AS "screeningScore",c.interview_score AS "interviewScore",c.assessment_score AS "assessmentScore",c.reference_status AS "referenceStatus",c.current_stage AS "currentStage",c.recruiter_notes AS "recruiterNotes",pr.id AS "personId",pr.full_name AS "fullName",pr.email,p.id AS "positionId",p.title AS position,d.name AS department FROM candidate_profiles c JOIN people_records pr ON pr.id=c.person_id LEFT JOIN org_positions p ON p.id=pr.position_id LEFT JOIN org_departments d ON d.id=p.department_id ORDER BY c.created_at DESC`);
  return res.json({ok:true,candidates:rows});
 }
 const b=req.body||{}; if(!b.fullName)return res.status(400).json({ok:false,error:'fullName is required'});
 const person=await db.query(`INSERT INTO people_records(full_name,email,phone,position_id,person_type,lifecycle_status,notes) VALUES($1,$2,$3,$4,'candidate','application',$5) RETURNING id,full_name AS "fullName",email`,[b.fullName,b.email||null,b.phone||null,b.positionId||null,b.notes||null]);
 const candidate=await db.query(`INSERT INTO candidate_profiles(person_id,source,current_stage,recruiter_notes) VALUES($1,$2,'application',$3) RETURNING id,current_stage AS "currentStage"`,[person.rows[0].id,b.source||null,b.notes||null]);
 res.status(201).json({ok:true,person:person.rows[0],candidate:candidate.rows[0]});
}