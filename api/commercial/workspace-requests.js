import { db } from 'hatchable';
export const access='admin'; export const methods=['GET'];
export default async function(req,res){const {rows}=await db.query("SELECT id,name,email,organization,plan,status,created_at,reviewed_at FROM commercial_workspace_requests ORDER BY created_at DESC");res.json({requests:rows});}