import type {DTO} from '../contracts/types';
import {ClientError} from './api';

export interface MetricsRange {window_start:string;window_end:string}
const routes=['PHOTO_LAYOUT','PER_SHOT_AI','REFERENCE_FILM'] as const;
const counts=['paid_orders','delivered_orders','unknown_submissions','refunds_pending','hard_deadline_failures'] as const;
const fields=['window_start','window_end',...counts,'cost_currency','cost_micro_total','automatic_pack_success_ratio','route_p95_seconds'];
export function metricsRange(start:string,end:string):MetricsRange {
  const from=Date.parse(start),to=Date.parse(end);
  if(!Number.isFinite(from)||!Number.isFinite(to)||to<=from||to-from>90*86400000)throw new ClientError('METRICS_WINDOW_INVALID','请选择完整起止时间，单次最多90天');
  return {window_start:new Date(from).toISOString(),window_end:new Date(to).toISOString()};
}
function summary(raw:unknown,range:MetricsRange):DTO<'MetricsSummary'> {
  const s=raw as DTO<'MetricsSummary'>|null,integer=(n:unknown,max=2147483647)=>typeof n==='number'&&Number.isSafeInteger(n)&&n>=0&&n<=max;
  if(!s||typeof s!=='object'||Object.keys(s).length!==fields.length||Object.keys(s).some(k=>!fields.includes(k))
    ||s.window_start!==range.window_start||s.window_end!==range.window_end||counts.some(k=>!integer(s[k]))
    ||!integer(s.cost_micro_total,Number.MAX_SAFE_INTEGER)||s.cost_currency!=='CNY'||s.delivered_orders>s.paid_orders
    ||(s.paid_orders===0?s.automatic_pack_success_ratio!==null:typeof s.automatic_pack_success_ratio!=='number'
      ||Math.abs(s.automatic_pack_success_ratio-s.delivered_orders/s.paid_orders)>1e-12)
    ||!s.route_p95_seconds||Object.keys(s.route_p95_seconds).length!==3||Object.keys(s.route_p95_seconds).some(k=>!routes.includes(k as typeof routes[number]))
    ||routes.some(k=>s.route_p95_seconds[k]!==null&&!integer(s.route_p95_seconds[k])))
    throw new ClientError('MANAGEMENT_RESPONSE_INVALID','统计回执与原时间窗口不一致，请重新读取');
  return s;
}
/** Read-only, fixed same-origin endpoint. Tokens and results are never put in
 * browser storage. A disconnected or superseded request cannot repopulate UI. */
export class MetricsClient {
  private token='';private generation=0;private active:AbortController|undefined;
  constructor(private transport:typeof fetch=(input,init)=>fetch(input,init)){}
  connect(token:string){this.disconnect();if(!token.trim())throw new ClientError('MANAGEMENT_LOGIN_REQUIRED','请输入独立运营访问令牌');this.token=token.trim();}
  disconnect(){this.generation++;this.active?.abort();this.active=undefined;this.token='';}
  async read(start:string,end:string):Promise<DTO<'MetricsSummary'>> {
    if(!this.token)throw new ClientError('MANAGEMENT_LOGIN_REQUIRED','请先连接运营账户');
    const range=metricsRange(start,end),generation=++this.generation;this.active?.abort();
    const controller=new AbortController();this.active=controller;const timer=setTimeout(()=>controller.abort(),20000);
    const current=()=>{if(generation!==this.generation)throw new ClientError('MANAGEMENT_ACCOUNT_CHANGED','运营连接或查询窗口已变化，请重新读取');};
    try{
      const response=await this.transport(`/v1/internal/p01/metrics/summary?${new URLSearchParams({...range})}`,{method:'GET',credentials:'omit',redirect:'error',cache:'no-store',
        headers:{Authorization:`Bearer ${this.token}`},signal:controller.signal});current();
      const raw=await response.text();current();if(raw.length>16384)throw new ClientError('MANAGEMENT_RESPONSE_INVALID','统计回执超过展示范围，请缩小窗口');
      let value:{data?:unknown;code?:string;message?:string};try{value=JSON.parse(raw);}catch{throw new ClientError('MANAGEMENT_RESPONSE_INVALID','未收到有效统计回执，请重新读取');}
      if(!response.ok)throw new ClientError(value.code??'MANAGEMENT_REQUEST_FAILED',value.message??'统计读取失败，请稍后重试',response.status);
      return summary(value.data,range);
    }catch(error){current();if(error instanceof ClientError)throw error;throw new ClientError('NETWORK_UNKNOWN','统计暂未读到，请重试原时间窗口');}
    finally{clearTimeout(timer);if(this.active===controller)this.active=undefined;}
  }
}
