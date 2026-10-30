import React,{useEffect,useRef,useState} from 'react';
import type {DTO} from '../shared/contracts/types';
import {ClientError} from '../shared/client/api';
import type {PlusClient} from './client';

export function PlusVideoRenderPanel({api,draft,dirty,onDelivered}:{api:PlusClient;draft:DTO<'PlusVideoDraft'>;dirty:boolean;onDelivered(orderId:string):void}){
  const [styles,setStyles]=useState<DTO<'PlusRenderStyle'>[]>([]),[style,setStyle]=useState('');
  const [requests,setRequests]=useState<DTO<'PlusVideoRenderPlan'>[]>([]),[next,setNext]=useState<string|null>(null),[current,setCurrent]=useState<DTO<'PlusVideoRenderPlan'>>();
  const [busy,setBusy]=useState(false),[error,setError]=useState('');const mounted=useRef(true),lock=useRef(false);
  const message=(e:unknown)=>e instanceof ClientError?e.message:'制作清单暂时无法读取，请刷新原记录';
  useEffect(()=>{mounted.current=true;const load=async()=>{try{const [s,r]=await Promise.all([api.call('listPlusVideoStyles'),api.call('listPlusVideoPlans',{query:{limit:20}})]);
    if(!mounted.current)return;setStyles(s.items);setStyle(s.items[0]?.variant_id??'');setRequests(r.items);setNext(r.next_cursor);
    setCurrent(r.items.find(x=>x.draft_id===draft.draft_id&&x.draft_revision===draft.revision));
  }catch(e){if(mounted.current)setError(message(e));}};void load();return()=>{mounted.current=false;};},[api,draft.draft_id,draft.revision]);
  useEffect(()=>{if(!current||['FAILED','BLOCKED'].includes(current.plan.state)||['DELIVERED','FAILED','CANCELLED'].includes(current.order?.fulfillment_state??''))return;
    let stopped=false;let timer:ReturnType<typeof setTimeout>|undefined;
    const poll=async()=>{if(stopped)return;if(document.hidden){timer=setTimeout(()=>void poll(),4000);return;}
      try{const value=await api.call('getPlusVideoPlan',{params:{request_id:current.request_id}});if(stopped)return;setCurrent(value);}
      catch(e){if(!stopped)setError(message(e));return;}if(!stopped)timer=setTimeout(()=>void poll(),4000);};
    timer=setTimeout(()=>void poll(),4000);return()=>{stopped=true;if(timer)clearTimeout(timer);};},[api,current?.request_id,current?.plan.state,current?.order?.fulfillment_state]);
  async function run(work:()=>Promise<void>){if(lock.current)return;lock.current=true;setBusy(true);setError('');
    try{await work();}catch(e){if(mounted.current)setError(message(e));}finally{lock.current=false;if(mounted.current)setBusy(false);}}
  const selected=styles.find(x=>x.variant_id===style),allowed=api.connected()?.connection.can_prepare_video_render_plans;
  return <section className='plus-render-panel' aria-label='独立视频正式制作'><h3>把编辑变成新成品</h3>
    <p className='plus-muted'>独立制作1支原片选段视频、真实首帧封面和配套文案，保留原素材。先整理清单，再到原小程序核对报价并主动付款。</p>
    <label>制作风格<select value={style} disabled={busy} onChange={e=>setStyle(e.target.value)}>{styles.map(s=><option key={`${s.variant_id}:${s.variant_version}`} value={s.variant_id}>{s.name}</option>)}</select></label>
    <p>{selected?.price_fen?`独立视频制作 ¥${(selected.price_fen/100).toFixed(2)}`:'正式制作价格尚未开放'}</p>
    {!allowed&&<p className='plus-muted'>当前连接只有草稿权限。重新接续时勾选「整理视频制作清单」，并在手机主动确认新权限。</p>}
    {dirty&&<p className='plus-muted'>请先保存当前修改，再整理这版制作清单。</p>}
    <button className='plus-primary' disabled={busy||dirty||!allowed||!selected?.sale_enabled} onClick={()=>void run(async()=>{
      const value=await api.call('createPlusVideoPlan',{params:{draft_id:draft.draft_id},body:{expected_revision:draft.revision,variant_id:selected!.variant_id,variant_version:selected!.variant_version}});
      if(!mounted.current)return;setCurrent(value);setRequests(items=>[value,...items.filter(x=>x.request_id!==value.request_id)]);
    })}>整理独立制作清单</button>
    {current&&<article className='plus-render-status'><strong>{current.order?.fulfillment_state==='DELIVERED'?'新成品已交付':current.order?.fulfillment_state==='FAILED'?'制作未完成，请回手机查看处理结果':current.order?.fulfillment_state==='CANCELLED'?'订单已取消，请回手机查看退款状态':current.order?.fulfillment_state==='IN_PROGRESS'?'正在制作和核验新素材':current.order?.fulfillment_state==='QUEUED'?'已付款，正在等待制作':current.order?'已建立原渠道订单，请回手机付款':current.plan.state==='READY'?'清单已就绪，请回手机确认费用':current.plan.state==='PLANNING'||current.plan.state==='VALIDATING'?'正在整理本版内容与规格':'清单未能完成，请查看当前记录'}</strong>
      <p>草稿版本 {current.draft_revision} · {current.settings.canvas.width}×{current.settings.canvas.height} · ¥{(current.price_fen/100).toFixed(2)}</p>
      <p className='plus-muted'>小程序：账户与隐私 → 接续到电脑 Plus → 电脑视频制作清单。未在手机确认付款前不会开始成品制作。</p>
      {current.order?.fulfillment_state==='DELIVERED'&&<button onClick={()=>onDelivered(current.order!.order_id)}>打开新成品素材包</button>}
    </article>}
    {requests.filter(r=>r.draft_id===draft.draft_id&&r.request_id!==current?.request_id).map(r=><button className='plus-source-row' key={r.request_id} disabled={busy} onClick={()=>void run(async()=>{const value=await api.call('getPlusVideoPlan',{params:{request_id:r.request_id}});if(mounted.current)setCurrent(value);})}>查看草稿版本 {r.draft_revision} 的制作记录</button>)}
    {next&&<button disabled={busy} onClick={()=>void run(async()=>{const more=await api.call('listPlusVideoPlans',{query:{limit:20,cursor:next}});if(mounted.current){setRequests(items=>[...items,...more.items]);setNext(more.next_cursor);}})}>更多制作记录</button>}
    {error&&<p role='alert'>{error}</p>}
  </section>;
}
