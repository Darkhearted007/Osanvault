import { db } from 'hatchable';
export const access='admin';
export const methods=['GET'];
export default async function(req,res){const {rows}=await db.query("SELECT article_no,title,text,category,protected,amendment_threshold,status FROM constitutional_articles WHERE status='Active' ORDER BY article_no");res.json(rows)}