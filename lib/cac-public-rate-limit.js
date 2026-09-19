import { db } from 'hatchable';
import { sha256Hex } from 'lib/cac-director-security.js';

function callerIp(req){
  const forwarded=String(req.headers?.['x-forwarded-for']||'').split(',')[0].trim();
  return forwarded || String(req.headers?.['x-real-ip']||'').trim() || 'unknown';
}

export async function enforcePublicRateLimit(req,res,routeKey,token='',limit=30){
  const ipHash=await sha256Hex(callerIp(req));
  const tokenHash=token ? await sha256Hex(token) : 'none';
  const bucket=new Date(Math.floor(Date.now()/60000)*60000).toISOString();
  const ipSubject=await sha256Hex(routeKey+'|ip|'+ipHash);
  const tokenSubject=await sha256Hex(routeKey+'|token|'+tokenHash);
  const ipResult=await db.query(
    'INSERT INTO cac_public_rate_limits (bucket_start,route_key,subject_hash,request_count,updated_at) VALUES ($1,$2,$3,1,now()) ON CONFLICT (bucket_start,route_key,subject_hash) DO UPDATE SET request_count=cac_public_rate_limits.request_count+1,updated_at=now() RETURNING request_count',
    [bucket,routeKey,ipSubject]
  );
  const tokenResult=await db.query(
    'INSERT INTO cac_public_rate_limits (bucket_start,route_key,subject_hash,request_count,updated_at) VALUES ($1,$2,$3,1,now()) ON CONFLICT (bucket_start,route_key,subject_hash) DO UPDATE SET request_count=cac_public_rate_limits.request_count+1,updated_at=now() RETURNING request_count',
    [bucket,routeKey,tokenSubject]
  );
  const count=Math.max(Number(ipResult.rows[0]?.request_count||0),Number(tokenResult.rows[0]?.request_count||0));
  res.setHeader('Cache-Control','no-store, no-cache, must-revalidate, private');
  res.setHeader('X-RateLimit-Limit',String(limit));
  res.setHeader('X-RateLimit-Remaining',String(Math.max(0,limit-count)));
  if(count>limit){
    res.setHeader('Retry-After','60');
    return false;
  }
  return true;
}