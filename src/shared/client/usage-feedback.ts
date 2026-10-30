import type {DTO} from '../contracts/types';
import {ClientError} from './api';

export function usageFeedback(raw:unknown,orderId:string):DTO<'UsageFeedback'>{
  const value=raw as DTO<'UsageFeedback'>|null;
  if(!value||typeof value!=='object'||Object.keys(value).length!==4||Object.keys(value).some(k=>!['order_id','choice','revision','updated_at'].includes(k))
    ||value.order_id!==orderId||!Number.isInteger(value.revision)||value.revision<0||value.revision>2147483647
    ||(value.choice!==null&&!['PLANNED_USE','USED','NEEDS_ADJUSTMENT'].includes(value.choice))
    ||(value.revision===0?(value.choice!==null||value.updated_at!==null):typeof value.updated_at!=='string'||!Number.isFinite(Date.parse(value.updated_at))))
    throw new ClientError('FEEDBACK_RESPONSE_INVALID','使用反馈回执与原订单不一致，请重新读取');
  return value;
}
