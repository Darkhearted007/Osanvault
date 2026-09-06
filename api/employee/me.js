import { db } from 'hatchable';
export const access='user'; export const methods=['GET'];
export default async function(req,res){
 const m=req.user;
 const p=await db.query(`SELECT pr.id,pr.full_name,pr.email,pr.phone,pr.lifecycle_status,op.title AS position,od.name AS department FROM people_records pr LEFT JOIN org_positions op ON op.id=pr.position_id LEFT JOIN org_departments od ON od.id=op.department_id WHERE lower(coalesce(pr.email,''))=lower($1) LIMIT 1`,[m.email||'']);
 if(!p.rows.length)return res.status(404).json({ok:false,error:'Employee profile not linked to this account'});
 const person=p.rows[0];
 const [contracts,comp,leave,training,assets,reviews,emergency]=await Promise.all([
  db.query('SELECT id,contract_type,start_date,end_date,probation_end_date,status,document_url,notes FROM employee_contracts WHERE person_id=$1 ORDER BY created_at DESC',[person.id]),
  db.query('SELECT effective_from,salary_amount,currency,pay_frequency,allowances,bonus_target,status FROM employee_compensation WHERE person_id=$1 ORDER BY effective_from DESC',[person.id]),
  db.query('SELECT leave_type,start_date,end_date,days,status,reason FROM employee_leave WHERE person_id=$1 ORDER BY start_date DESC',[person.id]),
  db.query('SELECT training_name,provider,completed_date,expiry_date,certificate_url,status FROM employee_training WHERE person_id=$1 ORDER BY completed_date DESC NULLS LAST',[person.id]),
  db.query('SELECT asset_type,asset_tag,issued_date,returned_date,condition_on_issue,condition_on_return,status FROM employee_assets WHERE person_id=$1 ORDER BY issued_date DESC',[person.id]),
  db.query('SELECT review_period,reviewer,rating,goals,strengths,development_areas,status FROM employee_performance_reviews WHERE person_id=$1 ORDER BY created_at DESC',[person.id]),
  db.query('SELECT full_name,relationship,phone,email,address,is_primary FROM employee_emergency_contacts WHERE person_id=$1 ORDER BY is_primary DESC,created_at DESC',[person.id])
 ]);
 res.json({ok:true,profile:person,contracts:contracts.rows,compensation:comp.rows,leave:leave.rows,training:training.rows,assets:assets.rows,reviews:reviews.rows,emergencyContacts:emergency.rows});
}