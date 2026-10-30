import {requestKey} from './request-key';
import type {DTO} from '../contracts/types';
import {ClientError} from './api';

type Pending={kind:'PROCESS';ticketId:string;body:DTO<'SupportProcessRequest'>;key:string}
  |{kind:'REPAIR';ticketId:string;orderId:string;body:DTO<'PlatformErrorRepairRequest'>;key:string};
/** Management credentials and uncertain writes are memory-only and scoped to one connection. */
export class SupportDeskClient{
  private credential='';private generation=0;private waiting:Pending|undefined;private controllers=new Set<AbortController>();
  constructor(private transport:typeof fetch=(input,init)=>fetch(input,init)){}
  connect(token:string){this.disconnect();if(!token.trim())throw new ClientError('MANAGEMENT_LOGIN_REQUIRED','请输入独立的客服访问令牌');this.credential=token.trim();}
  disconnect(){this.generation++;for(const c of this.controllers)c.abort();this.controllers.clear();this.credential='';this.waiting=undefined;}
  get pending(){return this.waiting!==undefined;}
  get pendingKind(){return this.waiting?.kind;}
  get pendingTicketId(){return this.waiting?.ticketId;}
  private async call<T>(path:string,body?:DTO<'SupportProcessRequest'>|DTO<'PlatformErrorRepairRequest'>,key?:string):Promise<T>{
    if(!this.credential)throw new ClientError('MANAGEMENT_LOGIN_REQUIRED','请先连接客服账户');
    const epoch=this.generation,controller=new AbortController();this.controllers.add(controller);const timer=setTimeout(()=>controller.abort(),20000);
    try{
      const response=await this.transport(`/v1/internal/p01${path}`,{method:body?'POST':'GET',credentials:'omit',redirect:'error',cache:'no-store',
        headers:{Authorization:`Bearer ${this.credential}`,...(body?{'Content-Type':'application/json','Idempotency-Key':key!}:{})},
        ...(body?{body:JSON.stringify(body)}:{}),signal:controller.signal});
      if(epoch!==this.generation)throw new ClientError('MANAGEMENT_ACCOUNT_CHANGED','客服连接已变化，请重新查看工单');
      const value=await response.json() as {data?:T;code?:string;message?:string};
      if(epoch!==this.generation)throw new ClientError('MANAGEMENT_ACCOUNT_CHANGED','客服连接已变化，请重新查看工单');
      if(!response.ok)throw new ClientError(value.code??'MANAGEMENT_REQUEST_FAILED',value.message??'工单请求失败，请刷新状态',response.status);
      if(!value.data||typeof value.data!=='object')throw new ClientError('MANAGEMENT_RESPONSE_INVALID','工单回执不完整，请查询原工单');
      return value.data;
    }catch(error){if(error instanceof ClientError)throw error;throw new ClientError('NETWORK_UNKNOWN','请求结果未确认，请保留原请求并查询工单');}
    finally{clearTimeout(timer);this.controllers.delete(controller);}
  }
  list(state?:DTO<'Ticket'>['state'],cursor?:string){const q=new URLSearchParams({limit:'20',...(state?{state}:{}),...(cursor?{cursor}:{})});return this.call<DTO<'ManagedSupportTicketList'>>(`/support-tickets?${q}`);}
  detail(ticketId:string){return this.call<DTO<'ManagedSupportDetail'>>(`/support-tickets/${encodeURIComponent(ticketId)}`);}
  evidence(ticketId:string,assetId:string){return this.call<DTO<'SupportEvidence'>>(`/support-tickets/${encodeURIComponent(ticketId)}/evidence/${encodeURIComponent(assetId)}`);}
  async repairContext(ticketId:string){
    const value=await this.call<DTO<'SupportRepairContext'>>(`/support-tickets/${encodeURIComponent(ticketId)}/repair-context`);
    if(value.ticket?.ticket_id!==ticketId||(value.manifest&&value.manifest.order_id!==value.ticket.order_id)||(value.repair&&value.repair.order_id!==value.ticket.order_id)
      ||Boolean(value.manifest)!==Boolean(value.product_profile))throw new ClientError('MANAGEMENT_RESPONSE_INVALID','原素材核对回执不匹配，请重新读取');
    return value;
  }
  async repairImage(ticketId:string,manifestRevision:number,deliverableId:string,expectedSha:string){
    const epoch=this.generation,value=await this.call<DTO<'SupportRepairImage'>>(`/support-tickets/${encodeURIComponent(ticketId)}/repair-manifests/${manifestRevision}/images/${encodeURIComponent(deliverableId)}`);
    if(value.manifest_revision!==manifestRevision||value.deliverable_id!==deliverableId||value.mime_type!=='image/png'||value.sha256!==expectedSha
      ||typeof value.bytes_base64!=='string'||value.bytes_base64.length>40_000_000||!/^[A-Za-z0-9+/]+={0,2}$/.test(value.bytes_base64))throw new ClientError('MANAGEMENT_RESPONSE_INVALID','原图片回执与素材清单不匹配');
    const bytes=Uint8Array.from(atob(value.bytes_base64),c=>c.charCodeAt(0));
    const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');
    if(epoch!==this.generation)throw new ClientError('MANAGEMENT_ACCOUNT_CHANGED','客服连接已变化，请重新查看工单');
    if(digest!==expectedSha||bytes.slice(0,8).join(',')!=='137,80,78,71,13,10,26,10')throw new ClientError('MANAGEMENT_RESPONSE_INVALID','原图片实际文件与素材清单不一致');
    return value;
  }
  async process(ticketId:string,body:DTO<'SupportProcessRequest'>):Promise<DTO<'ManagedSupportTicket'>>{
    if(this.waiting&&(this.waiting.kind!=='PROCESS'||this.waiting.ticketId!==ticketId||JSON.stringify(this.waiting.body)!==JSON.stringify(body)))throw new ClientError('MANAGEMENT_ORIGINAL_PENDING','请先确认或继续原工单操作');
    this.waiting??={kind:'PROCESS',ticketId,body:structuredClone(body),key:`support:${requestKey()}`};
    return this.retry();
  }
  async retry():Promise<DTO<'ManagedSupportTicket'>>{
    const pending=this.waiting;if(pending?.kind!=='PROCESS')throw new ClientError('MANAGEMENT_ORIGINAL_MISSING','没有待确认的原工单操作');
    try{
      const result=await this.call<DTO<'ManagedSupportTicket'>>(`/support-tickets/${encodeURIComponent(pending.ticketId)}/process`,pending.body,pending.key);
      if(result.ticket_id!==pending.ticketId||!Number.isInteger(result.revision)||result.revision!==pending.body.expected_revision+1)throw new ClientError('MANAGEMENT_RESPONSE_INVALID','工单回执不匹配，请继续原请求并刷新');
      if(this.waiting===pending)this.waiting=undefined;return result;
    }catch(error){if(error instanceof ClientError&&error.status&&error.status>=400&&error.status<500&&this.waiting===pending)this.waiting=undefined;throw error;}
  }
  async repair(orderId:string,ticketId:string,body:DTO<'PlatformErrorRepairRequest'>):Promise<DTO<'Revision'>>{
    if(body.ticket_id!==ticketId)throw new ClientError('MANAGEMENT_REQUEST_INVALID','纠错请求必须关联当前原工单');
    if(this.waiting&&(this.waiting.kind!=='REPAIR'||this.waiting.orderId!==orderId||this.waiting.ticketId!==ticketId||JSON.stringify(this.waiting.body)!==JSON.stringify(body)))throw new ClientError('MANAGEMENT_ORIGINAL_PENDING','请先确认或继续原操作');
    this.waiting??={kind:'REPAIR',orderId,ticketId,body:structuredClone(body),key:`support-repair:${requestKey()}`};return this.retryRepair();
  }
  async retryRepair():Promise<DTO<'Revision'>>{
    const pending=this.waiting;if(pending?.kind!=='REPAIR')throw new ClientError('MANAGEMENT_ORIGINAL_MISSING','没有待确认的原纠错请求');
    try{
      const result=await this.call<DTO<'Revision'>>(`/orders/${encodeURIComponent(pending.orderId)}/platform-repairs`,pending.body,pending.key);
      if(result.order_id!==pending.orderId||typeof result.revision_id!=='string'||!result.revision_id||result.consumes_user_allowance!==false
        ||!['REQUESTED','PROCESSING','COMPLETED','FAILED'].includes(result.state))throw new ClientError('MANAGEMENT_RESPONSE_INVALID','纠错回执不匹配，请继续原请求并刷新');
      if(this.waiting===pending)this.waiting=undefined;return result;
    }catch(error){if(error instanceof ClientError&&error.status&&error.status>=400&&error.status<500&&this.waiting===pending)this.waiting=undefined;throw error;}
  }
}
