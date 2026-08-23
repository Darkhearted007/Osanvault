import { db } from 'hatchable';
export const access='admin'; export const methods=['GET'];
export default async function(req,res){
 const docs=await db.query('SELECT id,document_code,title,document_type,version,status,effective_date,owner_role,summary FROM governance_documents ORDER BY document_type,title');
 const authority=await db.query('SELECT id,role_name,authority_area,authority_level,approval_limit,conditions,status FROM authority_matrix ORDER BY role_name,authority_area');
 const resolutions=await db.query('SELECT id,resolution_number,resolution_type,title,proposed_date,effective_date,status,decision_summary FROM corporate_resolutions ORDER BY proposed_date DESC,resolution_number DESC');
 res.json({documents:docs.rows,authority:authority.rows,resolutions:resolutions.rows});
}