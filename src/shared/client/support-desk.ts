import type {DTO} from '../contracts/types';
import {ClientError} from './api';

type Pending={ticketId:string;body:DTO<'SupportProcessRequest'>;key:string};
/** Management credentials and uncertain writes are memory-only and scoped to one connection. */
export class SupportDeskClient{
  private credential='';private generation=0;private waiting:Pending|undefined;private controllers=new Set<AbortController>();
  constructor(private transport:typeof fetch=(input,init)=>fetch(input,init)){}
  connect(token:string){this.disconnect();if(!token.trim())throw new ClientError('MANAGEMENT_LOGIN_REQUIRED','请输入独立的客服访问令牌');this.credential=token.trim();}
  disconnect(){this.generation++;for(const c of this.controllers)c.abort();this.controllers.clear();this.credential='';this.waiting=undefined;}
  get pending(){return this.waiting!==undefined;}
  private async call<T>(path:string,body?:DTO<'SupportProcessRequest'>,key?:string):Promise<T>{
    if(!this.credential)throw new ClientError('MANAGEMENT_LOGIN_REQUIRED','请先连接客服账户');
    const epoch=this.generation,controller=new AbortController();this.controllers.add(controller);const timer=setTimeout(()=>controller.abort(),20000);
    try{
      const response=await this.transport(`/v1/internal/p01/support-tickets${path}`,{method:body?'POST':'GET',credentials:'omit',redirect:'error',cache:'no-store',
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
  list(state?:DTO<'Ticket'>['state'],cursor?:string){const q=new URLSearchParams({limit:'20',...(state?{state}:{}),...(cursor?{cursor}:{})});return this.call<DTO<'ManagedSupportTicketList'>>(`?${q}`);}
  detail(ticketId:string){return this.call<DTO<'ManagedSupportDetail'>>(`/${encodeURIComponent(ticketId)}`);}
  evidence(ticketId:string,assetId:string){return this.call<DTO<'SupportEvidence'>>(`/${encodeURIComponent(ticketId)}/evidence/${encodeURIComponent(assetId)}`);}
  async process(ticketId:string,body:DTO<'SupportProcessRequest'>):Promise<DTO<'ManagedSupportTicket'>>{
    if(this.waiting&&(this.waiting.ticketId!==ticketId||JSON.stringify(this.waiting.body)!==JSON.stringify(body)))throw new ClientError('MANAGEMENT_ORIGINAL_PENDING','请先确认或继续原工单操作');
    this.waiting??={ticketId,body:structuredClone(body),key:`support:${crypto.randomUUID()}`};
    return this.retry();
  }
  async retry():Promise<DTO<'ManagedSupportTicket'>>{
    const pending=this.waiting;if(!pending)throw new ClientError('MANAGEMENT_ORIGINAL_MISSING','没有待确认的原操作');
    try{
      const result=await this.call<DTO<'ManagedSupportTicket'>>(`/${encodeURIComponent(pending.ticketId)}/process`,pending.body,pending.key);
      if(result.ticket_id!==pending.ticketId||!Number.isInteger(result.revision)||result.revision!==pending.body.expected_revision+1)throw new ClientError('MANAGEMENT_RESPONSE_INVALID','工单回执不匹配，请继续原请求并刷新');
      if(this.waiting===pending)this.waiting=undefined;return result;
    }catch(error){if(error instanceof ClientError&&error.status&&error.status>=400&&error.status<500&&this.waiting===pending)this.waiting=undefined;throw error;}
  }
}
