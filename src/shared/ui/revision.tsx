import React,{useEffect,useRef,useState} from 'react';
import {useDidShow} from '@tarojs/taro';
import {View,Text,Button,Textarea} from '@tarojs/components';
import type {DTO} from '../contracts/types';
import {client} from './runtime';
import {revisionProgress} from '../client/revisions';
import {Action,Notice,Panel,ResourceState,useAction,useResource} from './base';
const labels={COVER:'素材包封面',ALLOWED_ORDER:'展示顺序',DISPLAY_TEXT:'配套文案',IMAGE_TEXT:'图片加字'};
const kindName={image:'图片',video:'短片',copy:'文案'};
export function LimitedRevision({pack,onDelivered}:{pack:DTO<'Deliverables'>;onDelivered:()=>void}){
  const [kind,setKind]=useState<DTO<'RevisionRequest'>['kind']>('COVER');
  const [cover,setCover]=useState(pack.cover_deliverable_id??pack.items.find(i=>i.kind==='image')?.deliverable_id??'');
  const [ordered,setOrdered]=useState(pack.items.map(i=>i.deliverable_id));const [text,setText]=useState(pack.items.find(i=>i.kind==='copy')?.text??'');
  const [imageTarget,setImageTarget]=useState(pack.items.find(i=>i.kind==='image')?.deliverable_id??'');const [title,setTitle]=useState('');
  const action=useAction();const owner=useRef(client().api.userId);const refreshed=useRef('');
  const resource=useResource(async()=>{await client().login();return client().api.call('listRevisions',{params:{order_id:pack.order_id},query:{limit:20}});},
    data=>Boolean(data?.items.some(r=>['REQUESTED','PROCESSING'].includes(r.state))));
  useDidShow(()=>{if(owner.current!==client().api.userId){owner.current=client().api.userId;setText('');setTitle('');setImageTarget('');setOrdered([]);setCover('');resource.reload();}});
  const latest=resource.data?.items[0];const {active,delivered,customerCompleted:completed}=revisionProgress(resource.data?.items??[]);
  useEffect(()=>{if(delivered?.result_manifest_revision && delivered.result_manifest_revision>pack.manifest_revision && refreshed.current!==delivered.revision_id){refreshed.current=delivered.revision_id;onDelivered();}},[delivered?.revision_id,delivered?.result_manifest_revision,pack.manifest_revision,onDelivered]);
  const move=(index:number,delta:number):void=>setOrdered(old=>{const next=[...old];const target=index+delta;if(target<0 || target>=next.length)return old;[next[index],next[target]]=[next[target]!,next[index]!];return next;});
  const request:DTO<'RevisionRequest'>={manifest_revision:pack.manifest_revision,kind,...kind==='COVER'?{cover_deliverable_id:cover}:
    kind==='ALLOWED_ORDER'?{ordered_deliverable_ids:ordered}:kind==='IMAGE_TEXT'?{image_text:{deliverable_id:imageTarget,text:title.trim()}}:{display_text:text.trim()}};
  const changed=kind==='COVER'?cover!==(pack.cover_deliverable_id??pack.items.find(i=>i.kind==='image')?.deliverable_id):
    kind==='ALLOWED_ORDER'?ordered.join('|')!==pack.items.map(i=>i.deliverable_id).join('|'):kind==='IMAGE_TEXT'?Boolean(imageTarget&&title.trim()&&Array.from(title.trim()).length<=28):Boolean(text.trim() && text.trim()!==pack.items.find(i=>i.kind==='copy')?.text);
  return <Panel><Text className='card-title'>交付后的小修改</Text>
    <Text className='secondary'>交付后48小时内，可完成一次已支持的小修改，核验通过后领取新版本。图片、视频画面和对白保持原版；商品或风格有变化时请重新制作。</Text>
    <ResourceState {...resource} retry={resource.reload}/>
    {active?<Notice>修改已受理，正在制作和检查。你可以离开此页，回来后继续查看；原版素材仍可领取。</Notice>:completed?
      <Notice>本单小修改已完成，当前素材包已更新。</Notice>:resource.data && <>
        {latest?.state==='FAILED' && <Notice>本次修改未完成，原版素材已保留。你可以在原时限内重试，失败不占成功次数。</Notice>}
        <View className='filters'>{(Object.keys(labels) as DTO<'RevisionRequest'>['kind'][]).filter(value=>value!=='IMAGE_TEXT'||pack.revision_capabilities?.includes(value)).map(value=><Button key={value} className={`filter ${kind===value?'selected':''}`} onClick={()=>setKind(value)}>{labels[value]}</Button>)}</View>
        {kind==='COVER' && <><Text className='caption'>选择本单已有图片作为素材包封面。</Text><View className='filters'>{pack.items.filter(i=>i.kind==='image').map((item,index)=><Button key={item.deliverable_id} className={`filter ${cover===item.deliverable_id?'selected':''}`} onClick={()=>setCover(item.deliverable_id)}>图片 {index+1}{cover===item.deliverable_id?' · 已选':''}</Button>)}</View></>}
        {kind==='IMAGE_TEXT' && <><Text className='caption'>选择要加字的图片。保留完整画面，短标题排在下方留白区；通过核验后领取新图片。</Text>
          <View className='filters'>{pack.items.filter(i=>i.kind==='image').map((item,index)=><Button key={item.deliverable_id} className={`filter ${imageTarget===item.deliverable_id?'selected':''}`} onClick={()=>setImageTarget(item.deliverable_id)}>图片 {index+1}{imageTarget===item.deliverable_id?' · 已选':''}</Button>)}</View>
          <Text className='caption'>图片短标题 · 最多28字，请保留商品事实与原意</Text><Textarea className='feedback-input' maxlength={28} value={title} onInput={event=>setTitle(event.detail.value)}/></>}
        {kind==='ALLOWED_ORDER' && <>{ordered.map((id,index)=>{const item=pack.items.find(i=>i.deliverable_id===id)!;return <View key={id} className='save-row'><Text>{index+1}. {kindName[item.kind]} · 原第 {pack.items.indexOf(item)+1} 项</Text><Button className='filter' disabled={index===0} onClick={()=>move(index,-1)}>上移</Button><Button className='filter' disabled={index===ordered.length-1} onClick={()=>move(index,1)}>下移</Button></View>;})}</>}
        {kind==='DISPLAY_TEXT' && <><Text className='caption'>修改随素材交付的文案，不改视频字幕或对白。请保留商品事实与原意。</Text><Textarea className='feedback-input' maxlength={2000} value={text} onInput={event=>setText(event.detail.value)}/></>}
        <Action disabled={action.busy || !changed || !ordered.length} onClick={()=>void action.run(async()=>{
          await client().login();const account=client().api.userId;
          try{await client().api.call('requestLimitedRevision',{params:{order_id:pack.order_id},body:request,
            key:client().intent('limited-revision',{order:pack.order_id,request,after:latest?.revision_id??null})});}
          finally{if(account===client().api.userId)resource.reload();}
        })}>{action.busy?'正在受理…':'提交这次小修改'}</Action>
      </>}
    {action.error && <Notice error>{action.error}</Notice>}
  </Panel>;
}
