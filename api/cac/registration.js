import { db } from 'hatchable';
export const access = 'admin';
export const methods = ['GET','POST'];
export default async function(req,res){
  if(req.method==='GET'){
    const {rows}=await db.query(`SELECT c.*, COALESCE((SELECT count(*) FROM cac_registration_checklist x WHERE x.case_id=c.id AND x.status='complete'),0) completed_items, COALESCE((SELECT count(*) FROM cac_registration_checklist x WHERE x.case_id=c.id AND x.required=true),0) required_items FROM cac_registration_cases c ORDER BY c.created_at DESC`);
    return res.json(rows);
  }
  const b=req.body||{};
  const {rows}=await db.query(`INSERT INTO cac_registration_cases (company_name,share_capital,registered_office,created_by) VALUES ($1,$2,$3,$4) RETURNING *`,[b.companyName||'OSANVAULT AFRICA LTD',b.shareCapital||null,b.registeredOffice||null,req.member?.id||null]);
  const c=rows[0];
  const items=[['company_name','Company name','corporate'],['name_reservation','Name reservation','corporate'],['share_capital','Share capital','corporate'],['shareholders','Shareholders and allocation','ownership'],['directors','Directors and particulars','governance'],['psc','Persons with Significant Control','governance'],['registered_office','Registered office','corporate'],['objects','Company objects','corporate'],['memart','MEMART','documents'],['identity_documents','Identity documents','documents'],['director_consent','Director consent','governance'],['final_review','Final pre-filing review','filing']];
  for(const [code,title,category] of items) await db.query(`INSERT INTO cac_registration_checklist (case_id,code,title,category) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`,[c.id,code,title,category]);
  await db.query(`INSERT INTO cac_registration_events (case_id,event_type,actor_id,details) VALUES ($1,'case_created',$2,$3)`,[c.id,req.member?.id||null,JSON.stringify({companyName:c.company_name})]);
  return res.status(201).json(c);
}