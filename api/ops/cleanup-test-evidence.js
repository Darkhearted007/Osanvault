import { db } from 'hatchable';
export const access='admin';
export const methods=['GET'];
export default async function(req,res){res.status(410).json({ok:false,error:'Temporary cleanup endpoint retired.',publicExposure:false});}