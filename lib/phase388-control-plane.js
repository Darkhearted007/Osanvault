import { storage } from 'hatchable';
const KEY='phase388/control-plane.json';
const empty=()=>({organizations:[],members:[],positions:[],dashboards:[],assets:[],layers:[],invitations:[],accessEvents:[],events:[],intelligenceRules:[],relationships:[],assetIntelligence:[],assetHealth:[],risks:[],evidence:[],signals:[],mitigationPlans:[],eventSeq:0});
const decode=b=>new TextDecoder().decode(b);
export async function readState(){try{const x=await storage.get(KEY);const parsed=JSON.parse(decode(x.buffer));return {...empty(),...parsed}}catch{return empty()}}
export async function writeState(s){await storage.put(KEY,new TextEncoder().encode(JSON.stringify({...empty(),...s})), 'application/json');return s}
export function id(){return crypto.randomUUID()}
export async function sha256(value){const bytes=new TextEncoder().encode(value);const digest=await crypto.subtle.digest('SHA-256',bytes);return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('')}
export function audit(s,organization_id,member_id,actor_member_id,event_type,metadata={}){s.accessEvents=s.accessEvents||[];s.accessEvents.unshift({id:id(),organization_id,member_id,actor_member_id,event_type,metadata,created_at:new Date().toISOString()});s.accessEvents=s.accessEvents.slice(0,500)}
export function orgFor(s,organization_id){return (s.organizations||[]).find(x=>x.id===organization_id)}
export function memberFor(s,organization_id,member_id){return (s.members||[]).find(x=>x.organization_id===organization_id&&x.member_id===member_id)}