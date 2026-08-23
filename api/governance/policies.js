import { db } from 'hatchable';
export const access='admin'; export const methods=['GET','POST','PUT'];
export default async function(req,res){
 if(req.method==='GET'){const {rows}=await db.query('SELECT * FROM governance_documents ORDER BY document_type, title'); return res.json(rows);}
 const b=req.body||{};
 if(!b.title||!b.document_type) return res.status(400).json({error:'title and document_type are required'});
 const vals=[b.title,b.document_type,b.version||'1.0',b.status||'Draft',b.owner||null,b.jurisdiction||'Continental',b.review_cycle||'Annual',b.next_review_date||null,b.summary||null,b.document_url||null];
 if(req.method==='POST'){const {rows}=await db.query('INSERT INTO governance_documents (title,document_type,version,status,owner,jurisdiction,review_cycle,next_review_date,summary,document_url) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *',vals); return res.status(201).json(rows[0]);}
 if(!b.id)return res.status(400).json({error:'id is required for update'});
 const {rows}=await db.query('UPDATE governance_documents SET title=$1,document_type=$2,version=$3,status=$4,owner=$5,jurisdiction=$6,review_cycle=$7,next_review_date=$8,summary=$9,document_url=$10,updated_at=now() WHERE id=$11 RETURNING *',[...vals,b.id]); if(!rows.length)return res.status(404).json({error:'document not found'}); return res.json(rows[0]);
}