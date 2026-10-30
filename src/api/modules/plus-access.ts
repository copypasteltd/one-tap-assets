import type {Db} from '../db/pool.js';
import type {Config} from '../config.js';
import type {DTO,Principal} from '../../shared/contracts/types.js';
import {id,token,sha256,hmac,addSeconds} from '../lib/crypto.js';
import {requireThat,notFound} from '../lib/errors.js';
import {lockMediaOwner} from './media-access.js';
import {boundProjectSource,nativeBindingIdentity} from './account-bindings.js';

const liveGrant=`s.revoked_at IS NULL AND s.expires_at>now() AND (s.account_binding_id IS NULL OR EXISTS(
 SELECT 1 FROM account_bindings b WHERE b.id=s.account_binding_id AND b.revoked_at IS NULL AND
 ((b.alipay_identity_id=s.identity_id AND b.douyin_identity_id=s.approved_by_identity_id)
 OR (b.douyin_identity_id=s.identity_id AND b.alipay_identity_id=s.approved_by_identity_id))))`;

const allowed=new Set(['getPlusSession','revokePlusSession','listProducts','getProduct','getProductProfile','listOrders','getOrder','getDeliverables','createDownloadLink','createPlusEditDraft','getPlusEditDraft','savePlusEditDraft','listPlusEditDrafts','listPlusRenderStyles','createPlusRenderPlan','listPlusRenderPlans','getPlusRenderPlan','createPlusRenderBatch','listPlusRenderBatches','getPlusRenderBatch',
  'createPlusVideoDraft','getPlusVideoDraft','savePlusVideoDraft','listPlusVideoDrafts','listPlusVideoStyles','createPlusVideoPlan','listPlusVideoPlans','getPlusVideoPlan']);
export async function plusPrincipal(db:Db,bearer:string):Promise<Principal|undefined>{
  const row=(await db.query<{id:string;tenant_id:string;owner_id:string;platform:DTO<'Platform'>;app_id:string;subject_id:string}>(`SELECT s.id,s.tenant_id,s.owner_id,i.platform,i.app_id,i.subject_id
    FROM plus_sessions s JOIN platform_identities i ON i.tenant_id=s.tenant_id AND i.id=s.identity_id AND i.user_id=s.owner_id
    WHERE s.token_hash=$1 AND ${liveGrant}`,[sha256(bearer)])).rows[0];
  return row?{tenantId:row.tenant_id,userId:row.owner_id,sessionId:row.id,plusSessionId:row.id,platform:row.platform,appId:row.app_id,subjectId:row.subject_id}:undefined;
}
/** A grant is rechecked inside the business transaction. Owner-first locking
 * also serializes draft writes with revocation and media deletion. */
export async function assertPlusOperation(db:Db,p:Principal|null,operation:string):Promise<void>{
  if(!p?.plusSessionId)return;
  requireThat(allowed.has(operation),'PLUS_SCOPE_FORBIDDEN','电脑连接用于本人项目、编辑草稿和已授权的制作清单，请回原小程序处理交易',403);
  await lockMediaOwner(db,p.tenantId,p.userId);
  requireThat(!!(await db.query(`SELECT s.id FROM plus_sessions s WHERE s.tenant_id=$1 AND s.owner_id=$2 AND s.id=$3 AND ${liveGrant} FOR SHARE OF s`,[p.tenantId,p.userId,p.plusSessionId])).rowCount,
    'PLUS_SESSION_REVOKED','电脑连接已关闭或到期，请重新接续',401);
  if(operation==='createPlusRenderPlan'||operation==='createPlusRenderBatch')await assertPlusRenderGrant(db,p);
  if(operation==='createPlusVideoPlan')await assertPlusVideoGrant(db,p);
}
export async function assertPlusRenderGrant(db:Db,p:Principal):Promise<void>{
  requireThat(!!p.plusSessionId,'PLUS_SESSION_REQUIRED','请在电脑工作台提交制作清单',403);
  requireThat(!!(await db.query(`SELECT s.id FROM plus_sessions s WHERE s.tenant_id=$1 AND s.owner_id=$2 AND s.id=$3 AND s.allow_render_plans AND ${liveGrant}`,
    [p.tenantId,p.userId,p.plusSessionId])).rowCount,'PLUS_RENDER_APPROVAL_REQUIRED','请重新从小程序确认包含制作清单权限的电脑连接',403);
}
export async function assertPlusVideoGrant(db:Db,p:Principal):Promise<void>{
  requireThat(!!p.plusSessionId,'PLUS_SESSION_REQUIRED','请在电脑工作台整理视频制作清单',403);
  requireThat(!!(await db.query(`SELECT s.id FROM plus_sessions s WHERE s.tenant_id=$1 AND s.owner_id=$2 AND s.id=$3 AND s.allow_video_render_plans AND ${liveGrant}`,
    [p.tenantId,p.userId,p.plusSessionId])).rowCount,'PLUS_VIDEO_APPROVAL_REQUIRED','请重新从小程序确认包含视频制作清单权限的电脑连接',403);
}
export async function assertPlusDownload(db:Db,sessionId:string|undefined,tenantId:string,ownerId:string):Promise<void>{
  if(!sessionId)return;
  requireThat(!!(await db.query(`SELECT s.id FROM plus_sessions s WHERE s.tenant_id=$1 AND s.owner_id=$2 AND s.id=$3 AND ${liveGrant}`,[tenantId,ownerId,sessionId])).rowCount,
    'PLUS_SESSION_REVOKED','电脑连接已关闭，下载授权已失效',410);
}
type SessionRow={id:string;tenant_id:string;owner_id:string;platform:DTO<'Platform'>;created_at:Date;expires_at:Date;revoked_at:Date|null;allow_render_plans:boolean;allow_video_render_plans:boolean;account_binding_id:string|null};
function info(s:SessionRow):DTO<'PlusSessionInfo'>{return{session_id:s.id,platform:s.platform,created_at:s.created_at.toISOString(),expires_at:s.expires_at.toISOString(),state:s.revoked_at?'REVOKED':s.expires_at.getTime()<=Date.now()?'EXPIRED':'ACTIVE',can_prepare_render_plans:s.allow_render_plans,can_prepare_video_render_plans:s.allow_video_render_plans,...(s.account_binding_id?{account_binding_id:s.account_binding_id}:{})};}
async function native(db:Db,p:Principal):Promise<string>{
  return (await nativeBindingIdentity(db,p)).id;
}
const alphabet='23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
function userCode(cfg:Config,linkId:string):string{return [...Buffer.from(hmac(cfg.signingKey,'ypcc:plus-code:v1:'+linkId),'base64url').subarray(0,8)].map(n=>alphabet[n%32]).join('');}
type LinkRow={id:string;code_hash:string;poll_key_hash:string;state:DTO<'PlusLinkApproval'>['state'];expires_at:Date;tenant_id:string|null;owner_id:string|null;identity_id:string|null;session_id:string|null;allow_render_plans:boolean;allow_video_render_plans:boolean;account_binding_id:string|null;approved_by_identity_id:string|null;source_platform?:DTO<'Platform'>|null;approver_tenant_id?:string|null;approver_owner_id?:string|null};
function approval(cfg:Config,row:LinkRow):DTO<'PlusLinkApproval'>{return{link_id:row.id,user_code:userCode(cfg,row.id),expires_at:row.expires_at.toISOString(),state:row.state,access:'OWN_PROJECTS_AND_EDIT_DRAFTS',can_prepare_render_plans:row.allow_render_plans,can_prepare_video_render_plans:row.allow_video_render_plans,...(row.account_binding_id?{account_binding_id:row.account_binding_id}:{}),...(row.source_platform?{source_platform:row.source_platform}:{})};}
export async function createPlusLink(db:Db,cfg:Config,request:DTO<'PlusLinkCreateRequest'>={}):Promise<DTO<'PlusLink'>>{
  const linkId=id('pluslink'),secret=token(),code=userCode(cfg,linkId),expires=addSeconds(300);
  await db.query('INSERT INTO plus_links(id,code_hash,poll_key_hash,expires_at,allow_render_plans,allow_video_render_plans) VALUES($1,$2,$3,$4,$5,$6)',[linkId,sha256(code),sha256(secret),expires,request.prepare_render_plans===true,request.prepare_video_render_plans===true]);
  return{link_id:linkId,user_code:code,poll_key:secret,expires_at:expires,poll_interval_seconds:3};
}
async function inspect(db:Db,p:Principal,code:string,lock=false):Promise<LinkRow>{
  const row=(await db.query<LinkRow>(`SELECT l.*,i.platform source_platform,a.tenant_id approver_tenant_id,a.user_id approver_owner_id
    FROM plus_links l LEFT JOIN platform_identities i ON i.id=l.identity_id LEFT JOIN platform_identities a ON a.id=l.approved_by_identity_id
    WHERE l.code_hash=$1${lock?' FOR UPDATE OF l':''}`,[sha256(code)])).rows[0];
  if(!row||row.owner_id&&(row.owner_id!==p.userId||row.tenant_id!==p.tenantId)&&(row.approver_owner_id!==p.userId||row.approver_tenant_id!==p.tenantId))notFound();
  requireThat(row!.expires_at.getTime()>Date.now(),'PLUS_LINK_EXPIRED','接续码已过期，请在电脑上重新获取',410);return row!;
}
export async function inspectPlusLink(db:Db,cfg:Config,p:Principal,request:DTO<'PlusLinkInspectRequest'>):Promise<DTO<'PlusLinkApproval'>>{
  await native(db,p);return approval(cfg,await inspect(db,p,request.user_code));
}
export async function decidePlusLink(db:Db,cfg:Config,p:Principal,request:DTO<'PlusLinkDecisionRequest'>):Promise<DTO<'PlusLinkApproval'>>{
  const actor=await nativeBindingIdentity(db,p);
  const bound=request.decision==='APPROVE'&&request.account_binding_id?await boundProjectSource(db,p,request.account_binding_id):null;
  const source=bound?.source??actor;
  if(!bound)await lockMediaOwner(db,p.tenantId,p.userId);
  const row=await inspect(db,p,request.user_code,true),state=request.decision==='APPROVE'?'APPROVED':'DENIED';
  requireThat(row.state==='PENDING'||row.state===state,'PLUS_LINK_ALREADY_DECIDED','该接续码已有处理结果，请重新获取',409);
  if(row.state!=='PENDING')requireThat(row.identity_id===source.id&&(row.account_binding_id??null)===(bound?.bindingId??null),'PLUS_LINK_SOURCE_CHANGED','该接续已确认其他项目来源，请使用新接续码',409);
  if(row.state==='PENDING')await db.query('UPDATE plus_links SET state=$1,tenant_id=$2,owner_id=$3,identity_id=$4,account_binding_id=$6,approved_by_identity_id=$7 WHERE id=$5',
    [state,source.tenant_id,source.user_id,source.id,row.id,bound?.bindingId??null,actor.id]);
  return approval(cfg,{...row,state,account_binding_id:bound?.bindingId??null,source_platform:source.platform});
}
export async function pollPlusLink(db:Db,cfg:Config,linkId:string,request:DTO<'PlusLinkPollRequest'>):Promise<DTO<'PlusLinkStatus'>>{
  const lookup=async(lock=false)=>(await db.query<LinkRow>(`SELECT * FROM plus_links WHERE id=$1 AND poll_key_hash=$2${lock?' FOR UPDATE':''}`,[linkId,sha256(request.poll_key)])).rows[0];
  let row=await lookup();if(!row)notFound();
  requireThat(row!.expires_at.getTime()>Date.now(),'PLUS_LINK_EXPIRED','接续码已过期，请重新获取',410);
  if(row!.state!=='APPROVED')return{state:row!.state};
  await lockMediaOwner(db,row!.tenant_id!,row!.owner_id!);row=(await lookup(true))!;
  requireThat(row.expires_at.getTime()>Date.now(),'PLUS_LINK_EXPIRED','接续码已过期，请重新获取',410);
  if(row.account_binding_id)requireThat(!!(await db.query(`SELECT id FROM account_bindings WHERE id=$1 AND revoked_at IS NULL AND
    ((alipay_identity_id=$2 AND douyin_identity_id=$3) OR (douyin_identity_id=$2 AND alipay_identity_id=$3))`,[row.account_binding_id,row.identity_id,row.approved_by_identity_id])).rowCount,
    'ACCOUNT_BINDING_REVOKED','账号绑定已解除，请重新证明控制权',410);
  const accessToken=hmac(cfg.signingKey,'ypcc:plus-session:v1:'+row.id+':'+request.poll_key);
  if(!row.session_id){
    const active=await db.query('SELECT id FROM plus_sessions WHERE tenant_id=$1 AND owner_id=$2 AND revoked_at IS NULL AND expires_at>now()',[row.tenant_id,row.owner_id]);
    requireThat(active.rows.length<5,'PLUS_CONNECTION_LIMIT','已有5个有效电脑连接，请在小程序中关闭一个后重试',409);
    row.session_id=id('plussession');await db.query('INSERT INTO plus_sessions(id,tenant_id,owner_id,identity_id,token_hash,expires_at,allow_render_plans,allow_video_render_plans,account_binding_id,approved_by_identity_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[row.session_id,row.tenant_id,row.owner_id,row.identity_id,sha256(accessToken),addSeconds(3600),row.allow_render_plans,row.allow_video_render_plans,row.account_binding_id,row.approved_by_identity_id]);
    await db.query('UPDATE plus_links SET session_id=$1 WHERE id=$2',[row.session_id,row.id]);
  }
  const session=(await db.query<SessionRow>(`SELECT s.*,i.platform FROM plus_sessions s JOIN platform_identities i ON i.id=s.identity_id AND i.tenant_id=s.tenant_id WHERE s.id=$1`,[row.session_id])).rows[0]!;
  requireThat(info(session).state==='ACTIVE','PLUS_SESSION_REVOKED','电脑连接已关闭或到期，不能重新领取旧连接',410);
  return{state:'APPROVED',session:{access_token:accessToken,token_type:'Bearer',user_id:row.owner_id!,expires_at:session.expires_at.toISOString(),connection:info(session)}};
}
export async function getPlusSession(db:Db,p:Principal):Promise<DTO<'PlusSessionInfo'>>{
  requireThat(!!p.plusSessionId,'PLUS_SESSION_REQUIRED','请先在小程序确认当前电脑接续',403);
  const s=(await db.query<SessionRow>('SELECT s.*,i.platform FROM plus_sessions s JOIN platform_identities i ON i.id=s.identity_id WHERE s.tenant_id=$1 AND s.owner_id=$2 AND s.id=$3',[p.tenantId,p.userId,p.plusSessionId])).rows[0]??notFound();return info(s);
}
export async function listPlusSessions(db:Db,p:Principal):Promise<DTO<'PlusSessionList'>>{
  const actor=await native(db,p);
  const rows=(await db.query<SessionRow>(`SELECT s.*,i.platform FROM plus_sessions s JOIN platform_identities i ON i.id=s.identity_id
    WHERE ((s.tenant_id=$1 AND s.owner_id=$2) OR s.approved_by_identity_id=$3) AND ${liveGrant} ORDER BY s.created_at DESC LIMIT 10`,[p.tenantId,p.userId,actor])).rows;
  return{items:rows.map(info),next_cursor:null};
}
export async function revokePlusSession(db:Db,p:Principal,sessionId:string):Promise<DTO<'PlusSessionInfo'>>{
  const actor=p.plusSessionId?null:await native(db,p);
  if(p.plusSessionId)requireThat(p.plusSessionId===sessionId,'PLUS_SCOPE_FORBIDDEN','只能关闭当前电脑连接',403);
  const row=(await db.query<SessionRow>(`SELECT s.*,i.platform FROM plus_sessions s JOIN platform_identities i ON i.id=s.identity_id
    WHERE s.id=$1 AND ((s.tenant_id=$2 AND s.owner_id=$3) OR ($4::text IS NOT NULL AND s.approved_by_identity_id=$4))`,[sessionId,p.tenantId,p.userId,actor])).rows[0]??notFound();
  await lockMediaOwner(db,row.tenant_id,row.owner_id);
  const changed=(await db.query<{revoked_at:Date}>('UPDATE plus_sessions SET revoked_at=coalesce(revoked_at,now()) WHERE id=$1 RETURNING revoked_at',[row.id])).rows[0]!;
  return info({...row,revoked_at:changed.revoked_at});
}
export async function createBoundProjectSession(db:Db,cfg:Config,p:Principal,bindingId:string):Promise<DTO<'PlusBrowserSession'>>{
  const bound=await boundProjectSource(db,p,bindingId),source=bound.source;
  const count=(await db.query('SELECT id FROM plus_sessions WHERE tenant_id=$1 AND owner_id=$2 AND revoked_at IS NULL AND expires_at>now()',[source.tenant_id,source.user_id])).rowCount??0;
  requireThat(count<5,'PLUS_CONNECTION_LIMIT','来源端已有5个有效连接，请先关闭不用的连接',409);
  const sessionId=id('plussession'),secret=token();
  const row=(await db.query<SessionRow>(`INSERT INTO plus_sessions(id,tenant_id,owner_id,identity_id,token_hash,expires_at,account_binding_id,approved_by_identity_id)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,[sessionId,source.tenant_id,source.user_id,source.id,sha256(secret),addSeconds(900),bindingId,bound.viewer.id])).rows[0]!;
  return{access_token:secret,token_type:'Bearer',user_id:source.user_id,expires_at:row.expires_at.toISOString(),connection:info({...row,platform:source.platform})};
}
