import {PlusVideoWorkspace} from './video-workspace';
import React,{useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import type {DTO} from '../shared/contracts/types';
import {ClientError} from '../shared/client/api';
import {PlusClient} from './client';
import {PlusRenderPanel} from './render-panel';
import {PlusBatchWorkspace} from './batch-workspace';
import './plus.css';

const api=new PlusClient(location.origin);
const sourceUrl=(value:DTO<'DownloadLink'>)=>{const url=new URL(value.url);if(url.origin!==location.origin)throw new ClientError('SOURCE_ORIGIN_CHANGED','素材地址与当前工作台不一致，请刷新连接');return url.href;};
function PlusApp(){
  const [link,setLink]=useState<DTO<'PlusLink'>>(),[connection,setConnection]=useState<DTO<'PlusSessionInfo'>>();
  const [products,setProducts]=useState<DTO<'ProductList'>>(),[orders,setOrders]=useState<DTO<'OrderList'>>(),[drafts,setDrafts]=useState<DTO<'PlusEditList'>>();
  const [pack,setPack]=useState<DTO<'Deliverables'>>(),[draft,setDraft]=useState<DTO<'PlusEditDraft'>>(),[settings,setSettings]=useState<DTO<'PlusEditSettings'>>(),[facts,setFacts]=useState('');
  const [image,setImage]=useState(''),[source,setSource]=useState<DTO<'Deliverable'>>(),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const [prepareVideo,setPrepareVideo]=useState(false),[videoOpen,setVideoOpen]=useState(false),[videoDraftId,setVideoDraftId]=useState<string>();
  const [prepareRender,setPrepareRender]=useState(false),[batchOpen,setBatchOpen]=useState(false);
  const lock=useRef(false),epoch=useRef(0),mounted=useRef(true);
  function reset(){epoch.current++;api.disconnect();setLink(undefined);setConnection(undefined);setProducts(undefined);setOrders(undefined);setDrafts(undefined);setPack(undefined);setDraft(undefined);setSettings(undefined);setFacts('');setImage('');setSource(undefined);setNotice('');setError('');setBatchOpen(false);setVideoOpen(false);setVideoDraftId(undefined);}
  async function run(work:()=>Promise<void>){if(lock.current)return;lock.current=true;const current=epoch.current;setBusy(true);setError('');setNotice('');
    try{await work();}catch(e){if(mounted.current&&current===epoch.current){if(connection&&!api.connected()){reset();setError('电脑连接已关闭或到期，请重新接续');}else setError(e instanceof ClientError?e.message:'暂时无法完成，请重新读取当前记录');}}
    finally{lock.current=false;if(mounted.current)setBusy(false);}}
  async function workspace(){const generation=epoch.current;
    const info=await api.call('getPlusSession');
    const [p,o,d]=await Promise.all([api.call('listProducts',{query:{limit:20}}),api.call('listOrders',{query:{limit:20}}),api.call('listPlusEditDrafts',{query:{limit:20}})]);
    if(generation!==epoch.current)return;setConnection(info);setProducts(p);setOrders(o);setDrafts(d);
  }
  useEffect(()=>{mounted.current=true;const hide=()=>reset();window.addEventListener('pagehide',hide);return()=>{mounted.current=false;epoch.current++;api.disconnect();window.removeEventListener('pagehide',hide);};},[]);
  useEffect(()=>api.onSessionEnded(()=>{reset();setError('电脑连接已关闭或到期，请重新接续');}),[]);
  useEffect(()=>{if(!connection)return;const timer=setTimeout(()=>{reset();setError('电脑连接已关闭或到期，请重新接续');},Math.max(0,Date.parse(connection.expires_at)-Date.now()));return()=>clearTimeout(timer);},[connection]);
  useEffect(()=>{
    if(!link||connection)return;let stopped=false;let timer:ReturnType<typeof setTimeout>|undefined;const current=epoch.current;
    const poll=async()=>{
      if(stopped||current!==epoch.current)return;
      if(Date.parse(link.expires_at)<=Date.now()){setError('接续码已过期，请重新生成');return;}
      if(document.hidden){timer=setTimeout(()=>void poll(),3000);return;}
      try{const value=await api.poll(link);if(stopped||current!==epoch.current)return;
        if(value.state==='APPROVED'){setLink(undefined);await workspace();return;}
        if(value.state==='DENIED'){setError('这次连接已在小程序中拒绝，可重新生成接续码');return;}
      }catch(e){if(!stopped&&current===epoch.current)setError(e instanceof ClientError?e.message:'接续暂未确认，请稍后重试');return;}
      if(!stopped)timer=setTimeout(()=>void poll(),3000);
    };
    timer=setTimeout(()=>void poll(),3000);return()=>{stopped=true;if(timer)clearTimeout(timer);};
  },[link,connection]);
  async function openPack(orderId:string){const value=await api.call('getDeliverables',{params:{order_id:orderId}});setPack(value);setDraft(undefined);setSettings(undefined);setImage('');setSource(undefined);setBatchOpen(false);setVideoOpen(false);setVideoDraftId(undefined);}
  async function imageDraft(next:DTO<'PlusEditDraft'>){
    const p=await api.call('getDeliverables',{params:{order_id:next.order_id}}),item=p.items.find(i=>i.deliverable_id===next.deliverable_id);
    if(!item)throw new ClientError('SOURCE_CHANGED','原素材已更新，请重新打开素材包');
    const url=await api.call('createDownloadLink',{params:{deliverable_id:next.deliverable_id},key:crypto.randomUUID()});
    setPack(p);setDraft(next);setSettings(structuredClone(next.settings));setFacts(next.settings.facts.join('\n'));setSource(item);setImage(sourceUrl(url));
  }
  function changeCrop(key:keyof DTO<'PlusEditSettings'>['crop'],value:number){if(!settings)return;setSettings({...settings,crop:{...settings.crop,[key]:value/100}});}
  const crop=settings?.crop,canvas=settings?.canvas;
  const cropAspect=source&&crop?((source.width??1080)*Math.max(.01,crop.width))/((source.height??1080)*Math.max(.01,crop.height)):1;
  const canvasAspect=canvas?Math.max(1,canvas.width)/Math.max(1,canvas.height):1;
  return <div className='plus-app'><header className='plus-header'><a className='plus-brand' href='/plus/' aria-label='一品成片 Plus 首页'><span className='plus-mark'>一</span><strong>一品成片</strong><span className='plus-tag'>Plus</span></a><span>把一件商品，做得更完整</span>{connection&&<><button className={videoOpen?'plus-primary':''} disabled={busy} onClick={()=>{setVideoOpen(v=>!v);setVideoDraftId(undefined);setBatchOpen(false);}}>{videoOpen?'返回素材编辑':'视频剪辑'}</button><button className={batchOpen?'plus-primary':''} disabled={busy} onClick={()=>{setBatchOpen(value=>!value);setVideoOpen(false);}}>{batchOpen?'返回单图编辑':'批量制作'}</button><button onClick={()=>void run(async()=>{await api.call('revokePlusSession',{params:{plus_session_id:connection.session_id}});reset();})}>关闭本机连接</button></>}</header>
    {connection?.account_binding_id&&<p className='plus-notice'>作品来源：已绑定的{connection.platform==='alipay'?'支付宝':'抖音'}端。付费制作和退款请回该来源小程序；解除绑定会关闭当前连接。</p>}
    {!connection?<main className='plus-welcome'><section><span className='plus-eyebrow'>手机拍好 · 电脑接着做</span><h1>给你的素材，<br/>多一点创作空间。</h1><p>从小程序继续本人作品，在更大的画布上调整图片裁切、规格与文字，保存独立编辑草稿。</p><div className='plus-permissions'><span>本人项目</span><span>原素材领取</span><span>独立草稿</span></div><p className='plus-muted'>拍照、制作、相册保存和基础社区发布，继续在支付宝或抖音小程序完成。</p></section><section className='plus-ticket'><h2>从手机接续到这里</h2><p>生成接续码，在小程序「账户与隐私 → 接续到电脑 Plus」中输入，选择当前端或已绑定端作品后确认。</p>{link&&<><output className='plus-code' aria-label='电脑接续码'>{link.user_code.slice(0,4)} {link.user_code.slice(4)}</output><p className='plus-muted'>5分钟内有效 · 等待你在手机上确认</p></>}
      <label className='plus-render-consent'><input type='checkbox' checked={prepareRender} onChange={e=>setPrepareRender(e.target.checked)}/>允许整理正式制作清单（每次付款仍需手机确认）</label><label className='plus-render-consent'><input type='checkbox' checked={prepareVideo} onChange={e=>setPrepareVideo(e.target.checked)}/>允许整理原片视频剪辑清单（独立计价，付款仍需手机确认）</label><button className='plus-primary' disabled={busy} onClick={()=>{reset();void run(async()=>{setLink(await api.call('createPlusLink',{body:{prepare_render_plans:prepareRender,prepare_video_render_plans:prepareVideo}}));});}}>{link?'重新生成接续码':'生成接续码'}</button><p className='plus-muted'>连接后可查看和编辑本人素材草稿，有效1小时，可随时从手机关闭。付款和退款仍在原小程序处理。</p></section></main>:
    videoOpen?<PlusVideoWorkspace key={videoDraftId??'video-library'} api={api} initialDraft={videoDraftId} onBack={()=>setVideoOpen(false)} onDelivered={orderId=>void run(()=>openPack(orderId))}/>:batchOpen?<PlusBatchWorkspace api={api} onDelivered={orderId=>void run(()=>openPack(orderId))}/>:<main className='plus-workbench'><aside className='plus-library'><div className='plus-section-head'><h2>我的创作</h2><button disabled={busy} onClick={()=>void run(workspace)}>刷新</button></div><p className='plus-muted'>{connection.platform==='alipay'?'支付宝':'抖音'}已确认 · {new Date(connection.expires_at).toLocaleTimeString()}到期</p>
      <h3>素材包</h3>{orders?.items.map(order=><button className={`plus-source-row ${pack?.order_id===order.order_id?'selected':''}`} disabled={busy||order.fulfillment_state!=='DELIVERED'} key={order.order_id} onClick={()=>void run(()=>openPack(order.order_id))}><strong>{order.fulfillment_state==='DELIVERED'?'查看已交付素材':'制作中的订单'}</strong><span>订单 {order.order_id.slice(-6)} · ¥{(order.amount_fen/100).toFixed(2)}</span></button>)}
      {orders&&!orders.items.length&&<p>还没有素材包。先用手机拍照，完成你的第一套。</p>}{orders?.next_cursor&&<button disabled={busy} onClick={()=>void run(async()=>{const next=await api.call('listOrders',{query:{limit:20,cursor:orders.next_cursor!}});setOrders({...next,items:[...orders.items,...next.items]});})}>更多素材包</button>}
      <h3>编辑草稿</h3>{drafts?.items.map(item=><button key={item.draft_id} className='plus-source-row' disabled={busy} onClick={()=>void run(async()=>imageDraft(await api.call('getPlusEditDraft',{params:{draft_id:item.draft_id}})))}><strong>{item.settings.title||'图片编辑草稿'}</strong><span>版本 {item.revision} · {item.settings.canvas.width}×{item.settings.canvas.height}</span></button>)}
      {drafts&&!drafts.items.length&&<p className='plus-muted'>选择素材包里的图片，开始独立编辑。</p>}{drafts?.next_cursor&&<button disabled={busy} onClick={()=>void run(async()=>{const next=await api.call('listPlusEditDrafts',{query:{limit:20,cursor:drafts.next_cursor!}});setDrafts({...next,items:[...drafts.items,...next.items]});})}>更多编辑草稿</button>}
      <h3>商品项目</h3><p className='plus-muted'>当前已同步 {products?.items.length??0} 个本人项目</p>{products?.next_cursor&&<button disabled={busy} onClick={()=>void run(async()=>{const next=await api.call('listProducts',{query:{limit:20,cursor:products.next_cursor!}});setProducts({...next,items:[...products.items,...next.items]});})}>更多商品项目</button>}
    </aside><section className='plus-canvas-section'><div className='plus-section-head'><h2>{draft?'图片编辑草稿':pack?'选择一份素材':'从一套素材开始'}</h2>{draft&&<span className='plus-tag'>独立版本 {draft.revision}</span>}</div>
      {!pack&&<div className='plus-empty'><span className='plus-mark'>一</span><h3>先选一套，再细细调整。</h3><p>从左侧打开本人素材包，查看原图、视频和文案。</p></div>}
      {draft&&settings&&crop&&<><div className='plus-canvas' style={{aspectRatio:canvasAspect}}><div className='plus-crop-window' style={{width:`${cropAspect>canvasAspect?100:100*cropAspect/canvasAspect}%`,height:`${cropAspect>canvasAspect?100*canvasAspect/cropAspect:100}%`}}>{image&&<img src={image} alt='原素材裁切预览' referrerPolicy='no-referrer' style={{width:`${100/Math.max(.01,crop.width)}%`,height:`${100/Math.max(.01,crop.height)}%`,left:`${-100*crop.x/Math.max(.01,crop.width)}%`,top:`${-100*crop.y/Math.max(.01,crop.height)}%`}}/>}</div>{(settings.title||settings.brand)&&<div className='plus-preview-copy'><small>{settings.brand}</small><strong>{settings.title}</strong></div>}</div><p className='plus-muted'>编辑预览 · 原素材包继续保留原版。此处保存草稿，后续新制作须另行确认清单、价格和验收。</p><button disabled={busy} onClick={()=>void run(async()=>imageDraft(await api.call('getPlusEditDraft',{params:{draft_id:draft.draft_id}})))}>重新读取已保存草稿</button></>}
      {pack&&!draft&&<div className='plus-deliverables'>{pack.items.map(item=><article key={item.deliverable_id}><span className='plus-tag'>{item.kind==='image'?'图片':item.kind==='video'?'视频':'文案'}</span><h3>{item.file_name||item.slot_id}</h3>{item.kind==='copy'?<><p className='plus-copy-text'>{item.text}</p><button onClick={()=>void run(async()=>{await navigator.clipboard.writeText(item.text??'');setNotice('文案已复制');})}>复制文案</button></>:<><p className='plus-muted'>{item.width}×{item.height}</p><button disabled={busy} onClick={()=>void run(async()=>{const value=await api.call('createDownloadLink',{params:{deliverable_id:item.deliverable_id},key:crypto.randomUUID()});const a=document.createElement('a');a.href=sourceUrl(value);a.download=item.file_name??item.deliverable_id;a.referrerPolicy='no-referrer';a.click();})}>领取原文件</button>{item.kind==='video'&&<button className='plus-primary' disabled={busy} onClick={()=>void run(async()=>{const next=await api.call('createPlusVideoDraft',{body:{order_id:pack.order_id,deliverable_id:item.deliverable_id}});setVideoDraftId(next.draft_id);setVideoOpen(true);})}>建立视频剪辑草稿</button>}{item.kind==='image'&&<button className='plus-primary' disabled={busy} onClick={()=>void run(async()=>imageDraft(await api.call('createPlusEditDraft',{body:{order_id:pack.order_id,deliverable_id:item.deliverable_id}})))}>建立图片编辑草稿</button>}</>}</article>)}</div>}
    </section><aside className='plus-controls'><h2>精细调整</h2>{settings&&draft?<><fieldset disabled={busy}><legend>裁切区域（%）</legend><div className='plus-fields'>{(['x','y','width','height'] as const).map((key,i)=><label key={key}>{['左边距','上边距','宽度','高度'][i]}<input type='number' min={key==='x'||key==='y'?0:1} max='100' step='1' value={Math.round(settings.crop[key]*10000)/100} onChange={e=>changeCrop(key,Number(e.target.value))}/></label>)}</div></fieldset>
      <fieldset disabled={busy}><legend>输出规格（像素）</legend><div className='plus-fields'>{(['width','height'] as const).map((key,i)=><label key={key}>{i?'高度':'宽度'}<input type='number' min='256' max='3840' value={settings.canvas[key]} onChange={e=>setSettings({...settings,canvas:{...settings.canvas,[key]:Number(e.target.value)}})}/></label>)}</div></fieldset>
      <label>标题<input maxLength={80} disabled={busy} value={settings.title} onChange={e=>setSettings({...settings,title:e.target.value})}/></label><label>品牌（可选）<input maxLength={60} disabled={busy} value={settings.brand} onChange={e=>setSettings({...settings,brand:e.target.value})}/></label><label>补充事实（每行一条，最多8条）<textarea rows={4} maxLength={1607} disabled={busy} value={facts} onChange={e=>setFacts(e.target.value)}/></label><p className='plus-muted'>你补充的事实和品牌会保留为待核对内容，正式制作前仍需核验。</p>
      <button className='plus-primary' disabled={busy} onClick={()=>void run(async()=>{const value=await api.call('savePlusEditDraft',{params:{draft_id:draft.draft_id},body:{expected_revision:draft.revision,settings:{...settings,facts:facts.split('\n').filter(v=>v.trim())}}});setDraft(value);setSettings(structuredClone(value.settings));setFacts(value.settings.facts.join('\n'));setDrafts(await api.call('listPlusEditDrafts',{query:{limit:20}}));setNotice(`编辑草稿已保存为版本 ${value.revision}`);})}>保存独立编辑草稿</button><PlusRenderPanel key={`${draft.draft_id}:${draft.revision}`} api={api} draft={draft} dirty={busy||JSON.stringify({...settings,facts:facts.split('\n').filter(v=>v.trim())})!==JSON.stringify(draft.settings)} onDelivered={orderId=>void run(()=>openPack(orderId))}/></>:<p className='plus-muted'>打开素材包并选择一张图片，即可调整裁切、规格和文字。</p>}</aside></main>}
    {(error||notice||busy)&&<div className={`plus-status ${error?'error':''}`} role={error?'alert':'status'}>{error||notice||'正在处理当前记录…'}{error&&<button onClick={()=>{reset();}}>重新接续</button>}</div>}
    <footer className='plus-footer'>一品成片 Plus · 本人作品接续与独立编辑草稿</footer>
  </div>;
}
createRoot(document.getElementById('app')!).render(<PlusApp/>);
