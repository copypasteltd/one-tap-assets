import type {DTO} from '../contracts/types';
import {ClientError} from './api';

type Pending={operation:'DECISION';publicationId:string;body:DTO<'ReviewDecisionRequest'>;key:string}
  |{operation:'PUBLISH';publicationId:string;body:DTO<'ManagementActionRequest'>;key:string};
export type ReviewMedia={mime_type:'image/png'|'video/mp4';bytes:Uint8Array};
/** Independent management credentials and original uncertain writes stay only
 * in this connection's memory. No buyer credential or arbitrary URL is accepted. */
export class ReviewDeskClient{
  private credential='';private epoch=0;private waiting:Pending|undefined;private controllers=new Set<AbortController>();
  constructor(private transport:typeof fetch=(input,init)=>fetch(input,init)){}
  connect(token:string){this.disconnect();if(!token.trim())throw new ClientError('MANAGEMENT_LOGIN_REQUIRED','请输入独立审核访问令牌');this.credential=token.trim();}
  disconnect(){this.epoch++;for(const c of this.controllers)c.abort();this.controllers.clear();this.credential='';this.waiting=undefined;}
  get pending(){return this.waiting!==undefined;}
  get pendingPublicationId(){return this.waiting?.publicationId;}
  private async call<T>(path:string,body?:Pending['body'],key?:string):Promise<T>{
    if(!this.credential)throw new ClientError('MANAGEMENT_LOGIN_REQUIRED','请先连接审核账户');
    const epoch=this.epoch,controller=new AbortController();this.controllers.add(controller);const timer=setTimeout(()=>controller.abort(),30000);
    try{
      const response=await this.transport(`/v1/internal/p01${path}`,{method:body?'POST':'GET',credentials:'omit',redirect:'error',cache:'no-store',
        headers:{Authorization:`Bearer ${this.credential}`,...(body?{'Content-Type':'application/json','Idempotency-Key':key!}:{})},
        ...(body?{body:JSON.stringify(body)}:{}),signal:controller.signal});
      if(epoch!==this.epoch)throw new ClientError('MANAGEMENT_ACCOUNT_CHANGED','审核连接已变化，请重新读取资料');
      const value=await response.json() as {data?:T;code?:string;message?:string};
      if(epoch!==this.epoch)throw new ClientError('MANAGEMENT_ACCOUNT_CHANGED','审核连接已变化，请重新读取资料');
      if(!response.ok)throw new ClientError(value.code??'MANAGEMENT_REQUEST_FAILED',value.message??'审核操作未完成，请刷新原申请',response.status);
      if(!value.data||typeof value.data!=='object')throw new ClientError('MANAGEMENT_RESPONSE_INVALID','审核回执不完整，请核对原申请');
      return value.data;
    }catch(e){if(e instanceof ClientError)throw e;throw new ClientError('NETWORK_UNKNOWN','原操作结果未确认，请继续确认原请求');}
    finally{clearTimeout(timer);this.controllers.delete(controller);}
  }
  list(state?:DTO<'PublicationState'>,cursor?:string){return this.call<DTO<'PublicationList'>>(`/publications?${new URLSearchParams({limit:'20',...(state?{state}:{}),...(cursor?{cursor}:{})})}`);}
  async detail(publicationId:string){const value=await this.call<DTO<'PublicationReviewDetail'>>(`/publications/${encodeURIComponent(publicationId)}`);
    if(value.publication?.publication_id!==publicationId||!Array.isArray(value.rights)||!Array.isArray(value.samples))throw new ClientError('MANAGEMENT_RESPONSE_INVALID','审核资料与原申请不匹配');return value;}
  private async verifyMedia(path:string,expected:{publicationId:string;sampleId:string|null;rightsId:string|null;itemId:string;mime?:string;sha?:string;size?:number}):Promise<ReviewMedia>{
    const epoch=this.epoch,value=await this.call<DTO<'PublicationReviewMedia'>>(path);
    if(value.publication_id!==expected.publicationId||value.sample_id!==expected.sampleId||value.rights_record_id!==expected.rightsId||value.item_id!==expected.itemId
      ||!['image/png','video/mp4'].includes(value.mime_type)||expected.mime&&value.mime_type!==expected.mime||expected.sha&&value.sha256!==expected.sha
      ||expected.size&&value.size_bytes!==expected.size||!Number.isSafeInteger(value.size_bytes)||value.size_bytes<1||value.size_bytes>125000000
      ||!/^[a-f0-9]{64}$/.test(value.sha256)||typeof value.bytes_base64!=='string'||value.bytes_base64.length>166666668||!/^[A-Za-z0-9+/]+={0,2}$/.test(value.bytes_base64))
      throw new ClientError('MANAGEMENT_RESPONSE_INVALID','审核文件回执与原申请不匹配');
    const bytes=Uint8Array.from(atob(value.bytes_base64),c=>c.charCodeAt(0));
    const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');
    if(epoch!==this.epoch)throw new ClientError('MANAGEMENT_ACCOUNT_CHANGED','审核连接已变化，请重新读取资料');
    if(bytes.length!==value.size_bytes||digest!==value.sha256||(value.mime_type==='image/png'?bytes.slice(0,8).join(',')!=='137,80,78,71,13,10,26,10':String.fromCharCode(...bytes.slice(4,8))!=='ftyp'))
      throw new ClientError('MANAGEMENT_RESPONSE_INVALID','实际审核文件与原摘要不一致');return {mime_type:value.mime_type,bytes};
  }
  sampleMedia(publicationId:string,file:DTO<'PublicationReviewFile'>){return this.verifyMedia(`/publications/${encodeURIComponent(publicationId)}/samples/${encodeURIComponent(file.sample_id)}/media/${encodeURIComponent(file.item_id)}`,
    {publicationId,sampleId:file.sample_id,rightsId:null,itemId:file.item_id,mime:file.mime_type,sha:file.sha256,size:file.size_bytes});}
  rightsEvidence(publicationId:string,rightsId:string,assetId:string){return this.verifyMedia(`/publications/${encodeURIComponent(publicationId)}/rights/${encodeURIComponent(rightsId)}/evidence/${encodeURIComponent(assetId)}`,
    {publicationId,sampleId:null,rightsId,itemId:assetId,mime:'image/png'});}
  private retain(next:Pending){
    if(this.waiting&&(this.waiting.operation!==next.operation||this.waiting.publicationId!==next.publicationId||JSON.stringify(this.waiting.body)!==JSON.stringify(next.body)))
      throw new ClientError('MANAGEMENT_ORIGINAL_PENDING','请先确认原申请的操作结果');this.waiting??=next;
  }
  async decide(publicationId:string,body:DTO<'ReviewDecisionRequest'>){this.retain({operation:'DECISION',publicationId,body:structuredClone(body),key:`review:${crypto.randomUUID()}`});return this.retry();}
  async publish(publicationId:string,body:DTO<'ManagementActionRequest'>){this.retain({operation:'PUBLISH',publicationId,body:structuredClone(body),key:`publish:${crypto.randomUUID()}`});return this.retry();}
  async retry():Promise<DTO<'Publication'>>{
    const original=this.waiting;if(!original)throw new ClientError('MANAGEMENT_ORIGINAL_MISSING','当前没有待确认的原操作');
    try{
      const result=await this.call<DTO<'Publication'>>(`/publications/${encodeURIComponent(original.publicationId)}/${original.operation==='DECISION'?'review-decisions':'publish'}`,original.body,original.key);
      if(result.publication_id!==original.publicationId||original.operation==='PUBLISH'&&result.state!=='PUBLISHED'
        ||original.operation==='DECISION'&&(result.revision!==original.body.expected_revision+1||result.state!=={APPROVE:'APPROVED',REQUEST_CHANGES:'CHANGES_REQUESTED',REJECT:'REJECTED'}[original.body.decision]))
        throw new ClientError('MANAGEMENT_RESPONSE_INVALID','原审核操作回执不匹配，请继续原请求');
      if(this.waiting===original)this.waiting=undefined;return result;
    }catch(e){if(e instanceof ClientError&&e.status&&e.status>=400&&e.status<500&&this.waiting===original)this.waiting=undefined;throw e;}
  }
}
