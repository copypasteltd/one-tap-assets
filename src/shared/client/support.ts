import type {DTO} from '../contracts/types';
import type {LocalPhoto} from '../platform/ports';
import type {ClientSession} from './session';
import {ClientError} from './api';
import {uploadEvidence} from './evidence';

export const supportCategories={PAYMENT:'付款问题',GENERATION:'制作问题',PRODUCT_ERROR:'商品或文字错误',SAVE:'保存问题',REFUND:'退款问题',OTHER:'其他问题'};
export const ticketStates={OPEN:'已受理',PROCESSING:'处理中',RESOLVED:'已处理',CLOSED:'已关闭'};
export interface SupportInput {category:DTO<'TicketRequest'>['category'];message:string;photos:LocalPhoto[]}
export class SupportSubmission {
  private readonly buyer:string|null;
  private original:{input:SupportInput;signature:string;batch:string}|undefined;
  private result:DTO<'Ticket'>|undefined;
  private flight:Promise<DTO<'Ticket'>>|undefined;
  constructor(private readonly session:ClientSession,readonly orderId:string,private readonly live:()=>void=()=>{}){this.buyer=session.api.userId;}
  get pending(){return Boolean(this.original&&!this.result);}
  private scope(){
    if(!this.buyer||this.session.api.userId!==this.buyer)throw new ClientError('ACCOUNT_CHANGED','账户已变化，请查看当前账户的反馈记录');
    this.live();
  }
  submit(value:SupportInput):Promise<DTO<'Ticket'>>{
    try{
      this.scope();const input={...value,message:value.message.trim(),photos:[...value.photos]};
      if(!Object.prototype.hasOwnProperty.call(supportCategories,input.category)||!input.message||Array.from(input.message).length>2000||input.photos.length>5)
        throw new ClientError('SUPPORT_INPUT_INVALID','请选择问题类型，填写1至2000字说明，并选择不超过5张证明图片');
      for(const photo of input.photos)if(!['image/jpeg','image/png'].includes(photo.mime)||!photo.bytes.byteLength||photo.bytes.byteLength>10000000||!/^[a-f0-9]{64}$/.test(photo.sha256))
        throw new ClientError('SUPPORT_PHOTO_INVALID','证明图片须为不超过10MB的清晰JPG或PNG');
      const signature=this.session.intent('support-input',{order:this.orderId,category:input.category,message:input.message,photos:input.photos.map(p=>p.sha256)});
      if(this.original&&this.original.signature!==signature)throw new ClientError('SUPPORT_ORIGINAL_REQUIRED','上次提交结果尚待确认，请先继续原反馈或查询已有记录');
      if(this.result)return Promise.resolve(this.result);
      if(this.flight)return this.flight;
      this.original??={input,signature,batch:signature};
      this.flight=this.send(this.original).finally(()=>{this.flight=undefined;});return this.flight;
    }catch(error){return Promise.reject(error);}
  }
  private async send(original:NonNullable<SupportSubmission['original']>):Promise<DTO<'Ticket'>>{
    this.scope();const order=await this.session.api.call('getOrder',{params:{order_id:this.orderId}});this.scope();
    if(order.order_id!==this.orderId)throw new ClientError('ORDER_CHANGED','订单已变化，请重新查询原订单');
    const ids=original.input.photos.length?await uploadEvidence(this.session,original.input.photos,original.batch,'SUPPORT_EVIDENCE',()=>this.scope()):[];
    this.scope();const body:DTO<'TicketRequest'>={category:original.input.category,message:original.input.message,...(ids.length?{attachment_asset_ids:ids}:{})};
    const ticket=await this.session.api.call('createSupportTicket',{params:{order_id:this.orderId},body,key:this.session.intent('support-ticket',{order:this.orderId,body})});this.scope();
    if(ticket.order_id!==this.orderId||ticket.category!==body.category||!Object.prototype.hasOwnProperty.call(ticketStates,ticket.state)||!ticket.ticket_id)
      throw new ClientError('SUPPORT_RESULT_INVALID','反馈结果暂未确认，请查询原反馈记录');
    this.result=ticket;return ticket;
  }
}
