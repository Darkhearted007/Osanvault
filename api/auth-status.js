import { auth } from 'hatchable';
export const access = 'public';
export const methods = ['GET'];
export default async function(req,res){const user=await auth.getUser(req);res.json({authenticated:!!user,user:user?{id:user.id,email:user.email||null}:null});}