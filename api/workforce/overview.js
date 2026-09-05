import { db } from 'hatchable';
export const access='admin';
export const methods=['GET'];
export default async function(req,res){
 try{
  const [d,p,c,e]=await Promise.all([
   db.query('SELECT id,name,code,status FROM org_departments ORDER BY name'),
   db.query('SELECT p.id,p.title,p.employment_type,p.level,p.status,d.name AS department_name,r.title AS reports_to FROM org_positions p LEFT JOIN org_departments d ON d.id=p.department_id LEFT JOIN org_positions r ON r.id=p.reports_to_position_id ORDER BY d.name,p.title'),
   db.query('SELECT c.id,c.full_name,c.email,c.stage,c.source FROM workforce_candidates c ORDER BY c.created_at DESC'),
   db.query('SELECT e.id,e.full_name,e.email,e.employee_number,e.employment_status,e.start_date,e.onboarding_status FROM workforce_employees e ORDER BY e.full_name')
  ]);
  res.json({ok:true,departments:d.rows,positions:p.rows,candidates:c.rows,employees:e.rows});
 }catch(error){console.error('workforce_overview_error',String(error));res.status(500).json({ok:false,error:'workforce_overview_unavailable'});}
}