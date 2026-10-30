import type {DTO} from '../contracts/types';

export function plusRenderStatus(render:DTO<'PlusRenderPlan'>):string{
  const state=render.order?.fulfillment_state;
  if(state==='DELIVERED')return '新成品已交付';
  if(state==='FAILED')return '制作未完成，请在手机查看处理结果';
  if(state==='CANCELLED')return '订单已取消，请在手机查看退款状态';
  if(state==='IN_PROGRESS')return '正在制作与交叉核验';
  if(state==='QUEUED')return '已付款，等待制作';
  if(render.order)return '已建立订单，待手机主动付款';
  if(render.plan.state==='READY')return '清单已就绪，待手机确认费用';
  if(['PLANNING','VALIDATING'].includes(render.plan.state))return '正在整理内容与规格';
  return '清单未完成，可重新选择这件商品';
}
export function plusBatchPending(batch:DTO<'PlusBatch'>):boolean{
  return batch.items.some(item=>item.render&&(['PLANNING','VALIDATING'].includes(item.render.plan.state)||['QUEUED','IN_PROGRESS'].includes(item.render.order?.fulfillment_state??'')));
}
