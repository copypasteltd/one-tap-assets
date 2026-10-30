import {requestKey} from '../shared/client/request-key';
import React,{useEffect,useRef,useState} from 'react';
import type {DTO} from '../shared/contracts/types';
import {ClientError} from '../shared/client/api';
import {plusBatchPending,plusRenderStatus} from '../shared/domain/plus-batch-status';
import type {PlusClient} from './client';
import {PrivatePreview} from './private-preview';

type Choice={draft:DTO<'PlusEditDraft'>;variantKey:string};
const styleKey=(style:DTO<'PlusRenderStyle'>)=>`${style.variant_id}@${style.variant_version}`;
export function PlusBatchWorkspace({api,onDelivered}:{api:PlusClient;onDelivered(orderId:string):void}){
  const [drafts,setDrafts]=useState<DTO<'PlusEditList'>>(),[styles,setStyles]=useState<DTO<'PlusRenderStyle'>[]>([]),[defaultStyle,setDefaultStyle]=useState('');
  const [choices,setChoices]=useState<Choice[]>([]),[history,setHistory]=useState<DTO<'PlusBatchList'>>(),[batch,setBatch]=useState<DTO<'PlusBatch'>>();
  const [busy,setBusy]=useState(false),[error,setError]=useState('');const mounted=useRef(true),lock=useRef(false);
  const intent=useRef<DTO<'PlusBatchCreateRequest'>>();
  const message=(error:unknown)=>error instanceof ClientError?error.message:'批次暂时无法读取。请刷新批次记录，或使用原选择重试。';
  async function run(work:()=>Promise<void>){if(lock.current)return;lock.current=true;setBusy(true);setError('');
    try{await work();}catch(error){if(mounted.current)setError(message(error));}finally{lock.current=false;if(mounted.current)setBusy(false);}}
  useEffect(()=>{mounted.current=true;void run(async()=>{
    const [d,s,b]=await Promise.all([api.call('listPlusEditDrafts',{query:{limit:20}}),api.call('listPlusRenderStyles'),api.call('listPlusRenderBatches',{query:{limit:10}})]);
    if(!mounted.current)return;setDrafts(d);setStyles(s.items);setDefaultStyle(s.items.length?styleKey(s.items.find(style=>style.sale_enabled)??s.items[0]!):'');setHistory(b);
  });return()=>{mounted.current=false;intent.current=undefined;};},[api]);
  useEffect(()=>{if(!batch||!plusBatchPending(batch))return;let stopped=false;let timer:ReturnType<typeof setTimeout>|undefined;
    const poll=async()=>{if(stopped)return;if(document.hidden){timer=setTimeout(()=>void poll(),4000);return;}
      try{const value=await api.call('getPlusRenderBatch',{params:{batch_id:batch.batch_id}});if(!stopped)setBatch(value);}
      catch(error){if(!stopped)setError(message(error));return;}if(!stopped)timer=setTimeout(()=>void poll(),4000);};
    timer=setTimeout(()=>void poll(),4000);return()=>{stopped=true;if(timer)clearTimeout(timer);};
  },[api,batch?.batch_id,batch&&plusBatchPending(batch)]);
  const allowed=api.connected()?.connection.can_prepare_render_plans;
  const ready=choices.length>=2&&choices.every(choice=>styles.some(style=>styleKey(style)===choice.variantKey&&style.sale_enabled));
  const change=(work:()=>void)=>{intent.current=undefined;work();};
  return <main className='plus-batch-workspace'><section className='plus-batch-intro'><span className='plus-eyebrow'>一次整理 · 逐件交付</span><h1>让一组商品，都有自己的好成片。</h1>
    <p>选择2至10份已保存的图片草稿，分别确定风格。每件商品使用当前选中的草稿版本，独立生成清单、报价与订单。</p>
    <p className='plus-muted'>某件未完成时，其他商品可继续。手机逐件确认并付款，制作完成后逐件领取；原素材与原订单权益保留。</p></section>
    <section className='plus-batch-picker'><div className='plus-section-head'><h2>挑选这次要制作的草稿</h2><button disabled={busy} onClick={()=>void run(async()=>{const next=await api.call('listPlusEditDrafts',{query:{limit:20}});if(mounted.current){change(()=>setChoices([]));setDrafts(next);}})}>刷新草稿并清空选择</button></div>
      <label>新选择默认使用<select aria-label='批次默认风格' disabled={busy} value={defaultStyle} onChange={e=>setDefaultStyle(e.target.value)}>{styles.map(style=><option value={styleKey(style)} key={styleKey(style)}>{style.name}</option>)}</select></label>
      <div className='plus-batch-grid'>{drafts?.items.map(draft=>{const choice=choices.find(c=>c.draft.draft_id===draft.draft_id);return <article className={`plus-batch-draft ${choice?'selected':''}`} key={draft.draft_id}>
        <PrivatePreview api={api} deliverableId={draft.deliverable_id}/><div className='plus-batch-draft-copy'><label className='plus-batch-check'><input type='checkbox' aria-label={`选择${draft.settings.title||draft.draft_id.slice(-6)}`} checked={!!choice} disabled={busy||(!choice&&choices.length>=10)} onChange={()=>change(()=>setChoices(items=>choice?items.filter(c=>c.draft.draft_id!==draft.draft_id):[...items,{draft,variantKey:defaultStyle}]))}/><strong>{draft.settings.title||`图片草稿 ${draft.draft_id.slice(-6)}`}</strong></label>
          <p>版本 {draft.revision} · {draft.settings.canvas.width}×{draft.settings.canvas.height}</p><p className='plus-muted'>商品 {draft.product_id.slice(-6)} · 原素材 {draft.deliverable_id.slice(-6)}</p>
          {choice&&<label>这件的制作风格<select aria-label={`${draft.settings.title||draft.draft_id.slice(-6)}的制作风格`} disabled={busy} value={choice.variantKey} onChange={e=>change(()=>setChoices(items=>items.map(c=>c.draft.draft_id===draft.draft_id?{...c,variantKey:e.target.value}:c)))}>{styles.map(style=><option key={styleKey(style)} value={styleKey(style)}>{style.name} · {style.price_fen===null?'价格尚未开放':`¥${(style.price_fen/100).toFixed(2)}`}</option>)}</select></label>}
        </div></article>;})}</div>
      {drafts&&!drafts.items.length&&<p>先从「单图编辑」打开已交付素材，保存图片编辑草稿，再来批量选择。</p>}
      {drafts?.next_cursor&&<button disabled={busy} onClick={()=>void run(async()=>{const next=await api.call('listPlusEditDrafts',{query:{limit:20,cursor:drafts.next_cursor!}});if(mounted.current)setDrafts({...next,items:[...drafts.items,...next.items]});})}>更多图片草稿</button>}
      <div className='plus-batch-submit'><strong>已选择 {choices.length} / 10 份</strong><span>每件独立计价，不合并扣款</span><button className='plus-primary' disabled={busy||!allowed||!ready} onClick={()=>void run(async()=>{
        if(!intent.current)intent.current={request_key:requestKey(),items:choices.map(choice=>{const style=styles.find(s=>styleKey(s)===choice.variantKey)!;return {draft_id:choice.draft.draft_id,expected_revision:choice.draft.revision,variant_id:style.variant_id,variant_version:style.variant_version};})};
        const value=await api.call('createPlusRenderBatch',{body:intent.current});if(!mounted.current)return;intent.current=undefined;setBatch(value);
        const h=await api.call('listPlusRenderBatches',{query:{limit:10}});if(mounted.current)setHistory(h);
      })}>整理这批独立制作清单</button></div>
      {!allowed&&<p className='plus-muted'>当前连接只有草稿权限。请重新接续并在手机允许「整理独立制作清单」。</p>}
      {styles.length>0&&!styles.some(s=>s.sale_enabled)&&<p className='plus-muted'>正式制作尚未开放，可先保存和整理草稿。</p>}
    </section>
    {batch&&<section className='plus-batch-results' aria-label='当前批次'><div className='plus-section-head'><h2>这批的制作进度</h2><button disabled={busy} onClick={()=>void run(async()=>{const value=await api.call('getPlusRenderBatch',{params:{batch_id:batch.batch_id}});if(mounted.current)setBatch(value);})}>刷新本批次</button></div>
      <p>{batch.item_count}份选择 · {batch.prepared_count}份已建立独立清单 · {batch.preparation_failed_count}份整理未完成 · {batch.removed_count}份素材已移除</p>
      <p className='plus-muted'>手机：账户与隐私 → 接续到电脑 Plus → 批量制作记录。核对每件的内容和费用后，分别主动付款。</p>
      <div className='plus-batch-grid'>{batch.items.map(item=><article className='plus-batch-result' key={item.position}><span className='plus-tag'>第 {item.position} 件</span>
        <h3>{item.render?.settings.title||`图片制作 ${item.position}`}</h3><strong>{item.render?plusRenderStatus(item.render):item.state==='SOURCE_REMOVED'?'原商品或素材已移除':'这件暂未建立清单'}</strong>
        {item.render&&<><p>版本 {item.render.draft_revision} · {item.render.settings.canvas.width}×{item.render.settings.canvas.height} · ¥{(item.render.price_fen/100).toFixed(2)}</p>{item.render.order?.fulfillment_state==='DELIVERED'&&<button className='plus-primary' onClick={()=>onDelivered(item.render!.order!.order_id)}>打开这件的新成品</button>}</>}
        {item.failure&&<p>{item.failure.message}</p>}{item.state==='PREPARATION_FAILED'&&<p className='plus-muted'>刷新草稿后，重新选择这件商品再试。其他商品继续按各自记录处理。</p>}
      </article>)}</div></section>}
    <section className='plus-batch-history'><div className='plus-section-head'><h2>我的批次记录</h2><button disabled={busy} onClick={()=>void run(async()=>{const value=await api.call('listPlusRenderBatches',{query:{limit:10}});if(mounted.current)setHistory(value);})}>刷新批次记录</button></div>
      {history?.items.map(value=><button className={`plus-source-row ${batch?.batch_id===value.batch_id?'selected':''}`} key={value.batch_id} disabled={busy} onClick={()=>void run(async()=>{const current=await api.call('getPlusRenderBatch',{params:{batch_id:value.batch_id}});if(mounted.current)setBatch(current);})}><strong>{new Date(value.created_at).toLocaleString()} · {value.item_count}份选择</strong><span>{value.prepared_count}份独立清单 · {value.preparation_failed_count}份未完成 · {value.removed_count}份已移除</span></button>)}
      {history&&!history.items.length&&<p className='plus-muted'>还没有批次。先挑选草稿，整理第一批。</p>}{history?.next_cursor&&<button disabled={busy} onClick={()=>void run(async()=>{const more=await api.call('listPlusRenderBatches',{query:{limit:10,cursor:history.next_cursor!}});if(mounted.current)setHistory({...more,items:[...history.items,...more.items]});})}>更多批次记录</button>}
    </section>{busy&&<p role='status'>正在处理当前批次…</p>}{error&&<p className='plus-batch-error' role='alert'>{error}</p>}
  </main>;
}
