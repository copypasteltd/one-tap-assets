import {requestKey} from '../shared/client/request-key';
import React,{useEffect,useRef,useState} from 'react';
import type {DTO} from '../shared/contracts/types';
import {ClientError} from '../shared/client/api';
import type {PlusClient} from './client';
import {PlusVideoRenderPanel} from './video-render-panel';

const seconds=(frame:number)=>Math.round(frame/30*1000)/1000;
const frame=(value:string)=>Math.round(Number(value)*30);
export function PlusVideoWorkspace({api,initialDraft,onBack,onDelivered}:{api:PlusClient;initialDraft?:string|undefined;onBack():void;onDelivered(orderId:string):void}){
  const [items,setItems]=useState<DTO<'PlusVideoDraft'>[]>([]),[next,setNext]=useState<string|null>(null);
  const [draft,setDraft]=useState<DTO<'PlusVideoDraft'>>(),[settings,setSettings]=useState<DTO<'PlusVideoSettings'>>();
  const [src,setSrc]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[cursor,setCursor]=useState(0);
  const video=useRef<HTMLVideoElement>(null),mounted=useRef(true),lock=useRef(false);
  async function run(work:()=>Promise<void>){if(lock.current)return;lock.current=true;setBusy(true);setError('');setNotice('');
    try{await work();}catch(e){if(mounted.current)setError(e instanceof ClientError?e.message:'视频草稿暂时无法读取，请刷新原记录');}
    finally{lock.current=false;if(mounted.current)setBusy(false);}}
  async function open(id:string){const value=await api.call('getPlusVideoDraft',{params:{draft_id:id}});
    const link=await api.call('createDownloadLink',{params:{deliverable_id:value.deliverable_id},key:requestKey()});
    const url=new URL(link.url);if(url.origin!==location.origin)throw new ClientError('SOURCE_ORIGIN_CHANGED','素材地址已变化，请重新接续');
    if(!mounted.current)return;setDraft(value);setSettings(structuredClone(value.settings));setSrc(url.href);setCursor(value.settings.trim.start_frame);}
  async function refresh(){const value=await api.call('listPlusVideoDrafts',{query:{limit:20}});if(mounted.current){setItems(value.items);setNext(value.next_cursor);}}
  useEffect(()=>{mounted.current=true;void run(async()=>{await refresh();if(initialDraft)await open(initialDraft);});
    return()=>{mounted.current=false;};},[api,initialDraft]);
  useEffect(()=>{const element=video.current;return()=>{if(element){element.pause();element.removeAttribute('src');element.load();}};},[src]);
  const patch=(value:Partial<DTO<'PlusVideoSettings'>>)=>settings&&setSettings({...settings,...value});
  const dirty=!!draft&&!!settings&&JSON.stringify(draft.settings)!==JSON.stringify(settings);
  const trim=settings?.trim,total=draft?.source.frames??1,target=trim?trim.end_frame-trim.start_frame:0;
  const active=trim&&settings?.captions.find(c=>cursor-trim.start_frame>=c.start_frame&&cursor-trim.start_frame<c.end_frame);
  function seek(n:number){setCursor(n);if(video.current)video.current.currentTime=n/30;}
  function cue(index:number,value:Partial<DTO<'PlusVideoSettings'>['captions'][number]>){if(settings)patch({captions:settings.captions.map((c,i)=>i===index?{...c,...value}:c)});}
  return <main className='plus-video-workspace'><aside className='plus-library'><div className='plus-section-head'><h2>视频剪辑</h2><button onClick={onBack}>返回素材包</button></div>
    <p className='plus-muted'>从已交付视频建立独立草稿，原片继续保留。</p><button disabled={busy} onClick={()=>void run(refresh)}>刷新视频草稿</button>
    {items.map(item=><button key={item.draft_id} className={`plus-source-row ${draft?.draft_id===item.draft_id?'selected':''}`} disabled={busy} onClick={()=>void run(()=>open(item.draft_id))}>
      <strong>{item.settings.title||'原片剪辑草稿'}</strong><span>版本 {item.revision} · {seconds(item.settings.trim.end_frame-item.settings.trim.start_frame)}秒</span></button>)}
    {!items.length&&!busy&&<p>返回素材包，选择视频上的「建立视频剪辑草稿」。</p>}
    {next&&<button disabled={busy} onClick={()=>void run(async()=>{const list=await api.call('listPlusVideoDrafts',{query:{limit:20,cursor:next}});if(mounted.current){setItems(v=>[...v,...list.items]);setNext(list.next_cursor);}})}>更多视频草稿</button>}
  </aside><section className='plus-video-stage'><div className='plus-section-head'><h2>{settings?.title||'保留原片，选一段好内容'}</h2>{draft&&<span className='plus-tag'>独立版本 {draft.revision}</span>}</div>
    {draft&&settings&&trim?<><div className='plus-video-preview' style={{aspectRatio:settings.canvas.width/settings.canvas.height}}><div className='plus-video-preview-title'><small>{settings.brand}</small><strong>{settings.title}</strong></div>
      <div className='plus-video-viewport'><video key={src} ref={video} src={src} preload='metadata' playsInline muted={settings.audio_mode==='MUTE'} controls
        aria-label='原视频选段预览' style={{width:`${100/settings.crop.width}%`,height:`${100/settings.crop.height}%`,left:`${-100*settings.crop.x/settings.crop.width}%`,top:`${-100*settings.crop.y/settings.crop.height}%`}}
        onLoadedMetadata={()=>seek(trim.start_frame)} onTimeUpdate={e=>{const n=Math.floor(e.currentTarget.currentTime*30);setCursor(n);if(n>=trim.end_frame)e.currentTarget.pause();}}
        onPlay={e=>{if(e.currentTarget.currentTime*30<trim.start_frame||e.currentTarget.currentTime*30>=trim.end_frame)e.currentTarget.currentTime=trim.start_frame/30;}}/></div>
      <div className='plus-video-caption' aria-live='off'>{active?.text}</div><small className='plus-video-preview-footer'>{settings.audio_mode==='MUTE'?'关闭原声':'保留原声'}</small></div>
      <p className='plus-muted'>选段与字幕位置预览 · 正式版会按选定风格重新排版、核验并提取真实首帧封面。</p>
      <div className='plus-video-timeline' aria-label='已选原片范围'><div style={{left:`${trim.start_frame/total*100}%`,width:`${target/total*100}%`}}/></div>
      <input className='plus-video-scrub' type='range' min={0} max={total-1} step={1} value={Math.max(0,Math.min(total-1,cursor))} aria-label='预览原片位置' onChange={e=>seek(Number(e.target.value))}/>
      <p>原片位置 {seconds(cursor)}秒 · 选中 {seconds(trim.start_frame)}–{seconds(trim.end_frame)}秒 · 成片 {seconds(target)}秒</p>
      <div className='plus-video-cue-list'>{settings.captions.map((c,i)=><button key={i} className={active===c?'selected':''} onClick={()=>seek(trim.start_frame+c.start_frame)}><small>{seconds(c.start_frame)}–{seconds(c.end_frame)}秒</small><strong>{c.text||'待填写字幕'}</strong><span>{c.kind==='SUBTITLE'?'台词字幕':'画面文案'}</span></button>)}</div>
    </>:<div className='plus-empty'><span className='plus-mark'>一</span><h3>一段原片，再做一版。</h3><p>选段、裁切、定时字幕和原声选择，一起保存到独立视频草稿。</p></div>}
  </section><aside className='plus-controls'><h2>剪辑与字幕</h2>{draft&&settings&&trim&&<><fieldset disabled={busy}><legend>选段（秒，按30帧对齐）</legend><div className='plus-fields'>
    <label>开始<input aria-label='选段开始秒数' type='number' step={1/30} min={0} max={seconds(total-30)} value={seconds(trim.start_frame)} onChange={e=>patch({trim:{...trim,start_frame:frame(e.target.value)}})}/></label>
    <label>结束<input aria-label='选段结束秒数' type='number' step={1/30} min={1} max={seconds(total)} value={seconds(trim.end_frame)} onChange={e=>patch({trim:{...trim,end_frame:frame(e.target.value)}})}/></label></div></fieldset>
    <label>音轨<select aria-label='原声处理' disabled={busy} value={settings.audio_mode} onChange={e=>patch({audio_mode:e.target.value as 'PRESERVE'|'MUTE'})}><option value='PRESERVE'>保留原声</option><option value='MUTE'>关闭原声</option></select></label>
    <p className='plus-muted'>视频可选1–60秒；保留原声须符合当前听音能力（现有协议最长30秒），未通过独立听音与双复核不会交付。有声视频的免费受限修改仅调整文案。</p>
    <fieldset disabled={busy}><legend>画面裁切（%）</legend><div className='plus-fields'>{(['x','y','width','height'] as const).map((key,i)=><label key={key}>{['左边距','上边距','宽度','高度'][i]}<input type='number' min={i<2?0:1} max={100} value={Math.round(settings.crop[key]*10000)/100} onChange={e=>patch({crop:{...settings.crop,[key]:Number(e.target.value)/100}})}/></label>)}</div></fieldset>
    <fieldset disabled={busy}><legend>输出尺寸（偶数像素）</legend><div className='plus-fields'>{(['width','height'] as const).map((key,i)=><label key={key}>{i?'高度':'宽度'}<input type='number' step={2} min={256} max={1920} value={settings.canvas[key]} onChange={e=>patch({canvas:{...settings.canvas,[key]:Number(e.target.value)}})}/></label>)}</div></fieldset>
    <label>标题<input aria-label='视频标题' maxLength={80} value={settings.title} disabled={busy} onChange={e=>patch({title:e.target.value})}/></label>
    <label>品牌（可选）<input maxLength={60} value={settings.brand} disabled={busy} onChange={e=>patch({brand:e.target.value})}/></label>
    <label>补充事实（每行一条，待核对）<textarea rows={3} value={settings.facts.join('\n')} disabled={busy} onChange={e=>patch({facts:e.target.value.split('\n')})}/></label>
    <h3>定时字幕与画面文案</h3><p className='plus-muted'>时间从所选片段的0秒开始，按顺序填写，彼此不重叠。台词字幕须与实际声音一致。</p>
    {settings.captions.map((c,i)=><fieldset key={i} disabled={busy} className='plus-video-cue'><legend>第{i+1}条</legend><div className='plus-fields'>
      <label>出现（秒）<input type='number' step={1/30} min={0} value={seconds(c.start_frame)} aria-label={`字幕${i+1}开始`} onChange={e=>cue(i,{start_frame:frame(e.target.value)})}/></label>
      <label>结束（秒）<input type='number' step={1/30} min={0} value={seconds(c.end_frame)} aria-label={`字幕${i+1}结束`} onChange={e=>cue(i,{end_frame:frame(e.target.value)})}/></label></div>
      <label>文字用途<select value={c.kind} onChange={e=>cue(i,{kind:e.target.value as 'SUBTITLE'|'ON_SCREEN_COPY'})}><option value='ON_SCREEN_COPY'>画面文案</option><option value='SUBTITLE'>台词字幕</option></select></label>
      <textarea maxLength={200} rows={2} aria-label={`字幕${i+1}文字`} value={c.text} onChange={e=>cue(i,{text:e.target.value})}/><button onClick={()=>patch({captions:settings.captions.filter((_,n)=>n!==i)})}>移除这条</button></fieldset>)}
    <button disabled={busy||settings.captions.length>=40} onClick={()=>{const start=settings.captions.at(-1)?.end_frame??0;patch({captions:[...settings.captions,{start_frame:start,end_frame:Math.min(target,start+60),text:'',kind:'ON_SCREEN_COPY'}]});}}>添加定时字幕</button>
    <button className='plus-primary' disabled={busy||!dirty} onClick={()=>void run(async()=>{const saved=await api.call('savePlusVideoDraft',{params:{draft_id:draft.draft_id},body:{expected_revision:draft.revision,settings}});
      if(mounted.current){setDraft(saved);setSettings(structuredClone(saved.settings));setNotice(`视频草稿已保存为版本 ${saved.revision}`);}await refresh();})}>保存视频剪辑草稿</button>
    <button disabled={busy} onClick={()=>void run(()=>open(draft.draft_id))}>重新读取已保存版本</button>
    <PlusVideoRenderPanel key={`${draft.draft_id}:${draft.revision}`} api={api} draft={draft} dirty={dirty||busy} onDelivered={onDelivered}/></>}
    {(error||notice||busy)&&<p role={error?'alert':'status'} className={error?'plus-video-error':''}>{error||notice||'正在读取当前视频记录…'}</p>}
  </aside></main>;
}
