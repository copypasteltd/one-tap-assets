import type {Db} from '../db/pool.js';
import type {Config} from '../config.js';
import type {DTO,Principal} from '../../shared/contracts/types.js';
import {id,sha256,hmac,addSeconds,equalSecret} from '../lib/crypto.js';
import {requireThat,notFound} from '../lib/errors.js';
import {lockMediaOwner} from './media-access.js';

type Identity={id:string;tenant_id:string;user_id:string;platform:DTO<'Platform'>};
type RequestRow={id:string;origin_identity_id:string;peer_identity_id:string|null;state:'PENDING'|'CLAIMED'|'BOUND'|'CANCELLED'|'REJECTED';binding_id:string|null;
 created_at:Date;expires_at:Date;origin_platform:DTO<'Platform'>;peer_platform:DTO<'Platform'>|null};
export type BoundSource={bindingId:string;source:Identity;viewer:Identity};
type BindingRow={id:string;alipay_identity_id:string;douyin_identity_id:string;created_at:Date;revoked_at:Date|null};
const alphabet='23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
function code(cfg:Config,value:string):string{return [...Buffer.from(hmac(cfg.signingKey,value),'base64url').subarray(0,8)].map(n=>alphabet[n%32]).join('');}
function inviteCode(cfg:Config,requestId:string):string{return code(cfg,'ypcc:account-binding-invite:v1:'+requestId);}
function verificationCode(cfg:Config,row:RequestRow):string{return code(cfg,'ypcc:account-binding-verification:v1:'+row.id+':'+row.peer_identity_id);}

export async function nativeBindingIdentity(db:Db,p:Principal):Promise<Identity>{
 requireThat(!p.plusSessionId,'NATIVE_APPROVAL_REQUIRED','请使用已登录的小程序证明本端账号控制权',403);
 const row=(await db.query<Identity>(`SELECT i.id,i.tenant_id,i.user_id,i.platform FROM sessions s JOIN platform_identities i
  ON i.id=s.identity_id AND i.tenant_id=s.tenant_id AND i.user_id=s.owner_id
  WHERE s.id=$1 AND s.tenant_id=$2 AND s.owner_id=$3 AND s.revoked_at IS NULL AND s.expires_at>now() FOR SHARE OF s`,[p.sessionId,p.tenantId,p.userId])).rows[0];
 requireThat(!!row,'SESSION_EXPIRED','请重新登录小程序后确认',401);return row!;
}
async function identities(db:Db,ids:string[]):Promise<Identity[]>{
 return (await db.query<Identity>('SELECT id,tenant_id,user_id,platform FROM platform_identities WHERE id=ANY($1::text[])',[ids])).rows;
}
async function lockIdentities(db:Db,ids:string[]):Promise<void>{
 const rows=await identities(db,ids);
 for(const row of rows.sort((a,b)=>`${a.tenant_id}:${a.user_id}`.localeCompare(`${b.tenant_id}:${b.user_id}`)))await lockMediaOwner(db,row.tenant_id,row.user_id);
}
async function activeFor(db:Db,identityId:string):Promise<boolean>{
 return !!(await db.query('SELECT id FROM account_bindings WHERE revoked_at IS NULL AND (alipay_identity_id=$1 OR douyin_identity_id=$1)',[identityId])).rowCount;
}
async function requestRow(db:Db,field:'id'|'code_hash',value:string,lock=false):Promise<RequestRow>{
 return (await db.query<RequestRow>(`SELECT r.*,o.platform origin_platform,p.platform peer_platform FROM account_binding_requests r
  JOIN platform_identities o ON o.id=r.origin_identity_id LEFT JOIN platform_identities p ON p.id=r.peer_identity_id
  WHERE r.${field}=$1${lock?' FOR UPDATE OF r':''}`,[value])).rows[0]??notFound();
}
function participant(row:RequestRow,identityId:string):'ORIGIN'|'PEER'|'CANDIDATE'{return row.origin_identity_id===identityId?'ORIGIN':row.peer_identity_id===identityId?'PEER':'CANDIDATE';}
function ensureParticipant(row:RequestRow,identityId:string):void{if(participant(row,identityId)==='CANDIDATE')notFound();}
function live(row:RequestRow):void{requireThat(row.expires_at.getTime()>Date.now(),'ACCOUNT_BINDING_EXPIRED','绑定码已过期，请重新发起，旧请求不会延期',410);}
function requestInfo(cfg:Config,row:RequestRow,identityId:string):DTO<'AccountBindingRequest'>{
 const role=participant(row,identityId),state=['PENDING','CLAIMED'].includes(row.state)&&row.expires_at.getTime()<=Date.now()?'EXPIRED':row.state;
 return {request_id:row.id,state,role,origin_platform:row.origin_platform,created_at:row.created_at.toISOString(),expires_at:row.expires_at.toISOString(),
  ...(row.peer_platform?{peer_platform:row.peer_platform}:{}),...(role==='ORIGIN'?{user_code:inviteCode(cfg,row.id)}:{}),
  ...(row.peer_identity_id&&role!=='CANDIDATE'?{verification_code:verificationCode(cfg,row)}:{}),...(row.binding_id?{binding_id:row.binding_id}:{})};
}
async function bindingRow(db:Db,bindingId:string,identityId:string,lock=false):Promise<BindingRow>{
 return (await db.query<BindingRow>(`SELECT * FROM account_bindings WHERE id=$1 AND (alipay_identity_id=$2 OR douyin_identity_id=$2)${lock?' FOR UPDATE':''}`,[bindingId,identityId])).rows[0]??notFound();
}
function bindingInfo(row:BindingRow,identity:Identity):DTO<'AccountBinding'>{
 return{binding_id:row.id,peer_platform:identity.platform==='alipay'?'douyin':'alipay',state:row.revoked_at?'REVOKED':'ACTIVE',
  created_at:row.created_at.toISOString(),revoked_at:row.revoked_at?.toISOString()??null,access:'PROJECTS_DRAFTS_AND_EXPLICIT_PLUS_PLANS'};
}

export async function createAccountBindingRequest(db:Db,cfg:Config,p:Principal):Promise<DTO<'AccountBindingRequest'>>{
 const actor=await nativeBindingIdentity(db,p);await lockIdentities(db,[actor.id]);
 requireThat(!await activeFor(db,actor.id),'ACCOUNT_ALREADY_BOUND','已有有效绑定，请先解除后再绑定其他账号',409);
 const prior=(await db.query<{id:string}>(`SELECT id FROM account_binding_requests WHERE origin_identity_id=$1 AND state IN ('PENDING','CLAIMED') AND expires_at>now() ORDER BY created_at DESC LIMIT 1`,[actor.id])).rows[0];
 if(prior)return requestInfo(cfg,await requestRow(db,'id',prior.id),actor.id);
 const requestId=id('bindingrequest');await db.query(`INSERT INTO account_binding_requests(id,code_hash,origin_identity_id,expires_at) VALUES($1,$2,$3,$4)`,[requestId,sha256(inviteCode(cfg,requestId)),actor.id,addSeconds(300)]);
 return requestInfo(cfg,await requestRow(db,'id',requestId),actor.id);
}
export async function inspectAccountBindingCode(db:Db,cfg:Config,p:Principal,input:DTO<'AccountBindingCodeRequest'>):Promise<DTO<'AccountBindingRequest'>>{
 const actor=await nativeBindingIdentity(db,p),row=await requestRow(db,'code_hash',sha256(input.user_code));live(row);
 if(row.peer_identity_id&&participant(row,actor.id)==='CANDIDATE')notFound();
 requireThat(participant(row,actor.id)!=='CANDIDATE'||actor.platform!==row.origin_platform,'ACCOUNT_BINDING_OTHER_PLATFORM_REQUIRED','请在另一平台的小程序中输入绑定码',403);
 return requestInfo(cfg,row,actor.id);
}
export async function claimAccountBindingRequest(db:Db,cfg:Config,p:Principal,input:DTO<'AccountBindingCodeRequest'>):Promise<DTO<'AccountBindingRequest'>>{
 const actor=await nativeBindingIdentity(db,p);let row=await requestRow(db,'code_hash',sha256(input.user_code));
 await lockIdentities(db,[row.origin_identity_id,actor.id]);row=await requestRow(db,'id',row.id,true);live(row);
 requireThat(actor.platform!==row.origin_platform,'ACCOUNT_BINDING_OTHER_PLATFORM_REQUIRED','绑定需要支付宝和抖音两个不同平台的本人账号',403);
 if(row.peer_identity_id&&row.peer_identity_id!==actor.id)notFound();
 if(row.state==='CLAIMED'&&row.peer_identity_id===actor.id)return requestInfo(cfg,row,actor.id);
 requireThat(row.state==='PENDING','ACCOUNT_BINDING_NOT_PENDING','该请求已处理，请查询本人绑定记录',409);
 requireThat(!await activeFor(db,actor.id)&&!await activeFor(db,row.origin_identity_id),'ACCOUNT_ALREADY_BOUND','其中一端已有绑定，请先解除原绑定',409);
 const active=(await db.query('SELECT id FROM account_binding_requests WHERE peer_identity_id=$1 AND state=\'CLAIMED\' AND expires_at>now()',[actor.id])).rowCount??0;
 requireThat(active<3,'ACCOUNT_BINDING_PENDING_LIMIT','已有待确认的绑定，请先处理或等待到期',409);
 await db.query("UPDATE account_binding_requests SET peer_identity_id=$2,state='CLAIMED' WHERE id=$1",[row.id,actor.id]);
 return requestInfo(cfg,await requestRow(db,'id',row.id),actor.id);
}
export async function getAccountBindingRequest(db:Db,cfg:Config,p:Principal,requestId:string):Promise<DTO<'AccountBindingRequest'>>{
 const actor=await nativeBindingIdentity(db,p),row=await requestRow(db,'id',requestId);ensureParticipant(row,actor.id);return requestInfo(cfg,row,actor.id);
}
export async function listAccountBindingRequests(db:Db,cfg:Config,p:Principal):Promise<DTO<'AccountBindingRequestList'>>{
 const actor=await nativeBindingIdentity(db,p),rows=(await db.query<{id:string}>(`SELECT id FROM account_binding_requests WHERE (origin_identity_id=$1 OR peer_identity_id=$1)
  AND state IN ('PENDING','CLAIMED') AND expires_at>now() ORDER BY created_at DESC LIMIT 5`,[actor.id])).rows;
 const items=[];for(const row of rows)items.push(requestInfo(cfg,await requestRow(db,'id',row.id),actor.id));return{items,next_cursor:null};
}
export async function decideAccountBindingRequest(db:Db,cfg:Config,p:Principal,requestId:string,input:DTO<'AccountBindingDecisionRequest'>):Promise<DTO<'AccountBindingRequest'>>{
 const actor=await nativeBindingIdentity(db,p);let row=await requestRow(db,'id',requestId);ensureParticipant(row,actor.id);
  if(input.decision==='CONFIRM')requireThat(!!row.peer_identity_id,'ACCOUNT_BINDING_PEER_REQUIRED','另一端尚未主动确认',409);
 await lockIdentities(db,[row.origin_identity_id,...(row.peer_identity_id?[row.peer_identity_id]:[])]);row=await requestRow(db,'id',requestId,true);ensureParticipant(row,actor.id);
 if(input.decision==='CONFIRM'){
  requireThat(row.origin_identity_id===actor.id,'ACCOUNT_BINDING_ORIGIN_REQUIRED','请回发起绑定的小程序完成最后确认',403);
  if(row.state==='BOUND'){const bound=await bindingRow(db,row.binding_id!,actor.id);requireThat(!bound.revoked_at,'ACCOUNT_BINDING_REVOKED','绑定已解除，旧请求不能重新启用',410);return requestInfo(cfg,row,actor.id);}
  live(row);requireThat(row.state==='CLAIMED'&&!!row.peer_identity_id,'ACCOUNT_BINDING_PEER_REQUIRED','另一端尚未主动确认',409);
  requireThat(typeof input.verification_code==='string'&&equalSecret(input.verification_code,verificationCode(cfg,row)),'ACCOUNT_BINDING_VERIFICATION_MISMATCH','请核对两台设备显示的确认码一致后再确认',422);
  requireThat(!await activeFor(db,row.origin_identity_id)&&!await activeFor(db,row.peer_identity_id!),'ACCOUNT_ALREADY_BOUND','其中一端已有有效绑定，不能覆盖',409);
  const bindingId=id('binding'),alipay=row.origin_platform==='alipay'?row.origin_identity_id:row.peer_identity_id,douyin=row.origin_platform==='douyin'?row.origin_identity_id:row.peer_identity_id;
  await db.query('INSERT INTO account_bindings(id,alipay_identity_id,douyin_identity_id) VALUES($1,$2,$3)',[bindingId,alipay,douyin]);
  await db.query("UPDATE account_binding_requests SET state='BOUND',binding_id=$2 WHERE id=$1",[row.id,bindingId]);
 }else{
  const state=input.decision==='CANCEL'?'CANCELLED':'REJECTED';
  requireThat(input.decision==='CANCEL'?row.origin_identity_id===actor.id:row.peer_identity_id===actor.id,'ACCOUNT_BINDING_DECISION_FORBIDDEN','只能处理本人这一端的绑定请求',403);
  if(row.state!==state){requireThat(['PENDING','CLAIMED'].includes(row.state),'ACCOUNT_BINDING_NOT_PENDING','请求已结束；已绑定账号请使用解除绑定',409);
   await db.query('UPDATE account_binding_requests SET state=$2 WHERE id=$1',[row.id,state]);}
 }
 return requestInfo(cfg,await requestRow(db,'id',row.id),actor.id);
}
export async function listAccountBindings(db:Db,p:Principal):Promise<DTO<'AccountBindingList'>>{
 const actor=await nativeBindingIdentity(db,p),rows=(await db.query<BindingRow>('SELECT * FROM account_bindings WHERE alipay_identity_id=$1 OR douyin_identity_id=$1 ORDER BY created_at DESC,id DESC LIMIT 20',[actor.id])).rows;
 return{items:rows.map(row=>bindingInfo(row,actor)),next_cursor:null};
}
export async function boundProjectSource(db:Db,p:Principal,bindingId:string):Promise<BoundSource>{
 const viewer=await nativeBindingIdentity(db,p);let binding=await bindingRow(db,bindingId,viewer.id);
 await lockIdentities(db,[binding.alipay_identity_id,binding.douyin_identity_id]);binding=await bindingRow(db,bindingId,viewer.id);
 requireThat(!binding.revoked_at,'ACCOUNT_BINDING_REVOKED','绑定已解除，请重新证明两端控制权',410);
 const source=(await identities(db,[viewer.platform==='alipay'?binding.douyin_identity_id:binding.alipay_identity_id]))[0]??notFound();
 return{bindingId,source,viewer};
}
export async function revokeAccountBinding(db:Db,p:Principal,bindingId:string):Promise<DTO<'AccountBinding'>>{
 const actor=await nativeBindingIdentity(db,p);let binding=await bindingRow(db,bindingId,actor.id);
 await lockIdentities(db,[binding.alipay_identity_id,binding.douyin_identity_id]);binding=await bindingRow(db,bindingId,actor.id,true);
 if(!binding.revoked_at){binding=(await db.query<BindingRow>('UPDATE account_bindings SET revoked_at=now() WHERE id=$1 RETURNING *',[binding.id])).rows[0]!;}
 await db.query('UPDATE plus_sessions SET revoked_at=coalesce(revoked_at,now()) WHERE account_binding_id=$1',[binding.id]);
 return bindingInfo(binding,actor);
}
