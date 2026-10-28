import React,{useEffect,useRef,useState} from 'react';
import {useDidShow} from '@tarojs/taro';
import {Image,Text} from '@tarojs/components';
import type {DTO} from '../contracts/types';
import {client} from './runtime';
import {Action,Notice,Panel,ResourceState,useAction,useResource} from './base';

export function OptionalPreview({plan}:{plan:DTO<'Plan'>}) {
  const [previewId,setPreviewId]=useState(client().recover().previewId??''); const [url,setUrl]=useState('');
  const owner=useRef(client().api.userId); const action=useAction();
  useDidShow(()=>{if(owner.current!==client().api.userId){owner.current=client().api.userId;setUrl('');setPreviewId('');}});
  const resource=useResource(async()=>{
    if(!previewId)return null; await client().login();
    const preview=await client().api.call('getOptionalPreview',{params:{preview_id:previewId}});
    return preview.plan_id===plan.plan_id && preview.plan_hash===plan.plan_hash?preview:null;
  },p=>Boolean(p && ['QUEUED','GENERATING'].includes(p.state)));
  useEffect(()=>{setUrl('');resource.reload();},[previewId]);
  const preview=resource.data;
  return <Panel><Text className='card-title'>先看一张本人预览</Text><Text className='secondary'>使用你的照片和当前方案，预览首张图片。每日可新建5次，查看已有预览不扣次数。</Text>
    <Text className='caption'>本人预览带说明标记，不是最终素材包；可以直接跳过并继续查看费用。</Text>
    {!preview && <Action secondary disabled={action.busy} onClick={()=>void action.run(async()=>{
      await client().login(); const account=client().api.userId;owner.current=account;
      const result=await client().api.call('createOptionalPreview',{params:{product_id:plan.product_id},body:{plan_id:plan.plan_id,plan_hash:plan.plan_hash!},
        key:client().intent('optional-preview',{plan:plan.plan_id,hash:plan.plan_hash,day:new Date(Date.now()+8*3600000).toISOString().slice(0,10)})});
      if(account!==client().api.userId)return; client().remember({previewId:result.preview_id});setPreviewId(result.preview_id);resource.reload();
    })}>{action.busy?'正在受理…':'生成本人预览'}</Action>}
    {preview && ['QUEUED','GENERATING'].includes(preview.state) && <Text className='secondary'>{preview.state==='QUEUED'?'预览已受理，正在排队…':'正在生成本人预览…'}</Text>}
    {preview?.state==='FAILED' && <Notice>这次预览未能完成，你仍可查看清单和费用；已购任务不受预览额度影响。</Notice>}
    {preview?.state==='READY' && <><Action secondary disabled={action.busy} onClick={()=>void action.run(async()=>{
      const account=client().api.userId;
      const link=await client().api.call('createPreviewLink',{params:{preview_id:preview.preview_id},key:client().intent('preview-link',{preview:preview.preview_id,nonce:Date.now()})});
      if(account===client().api.userId)setUrl(link.url);
    })}>{url?'刷新预览链接':'查看本人预览'}</Action>{url && <Image src={url} mode='widthFix' className='optional-preview-image' onError={()=>setUrl('')} />}</>}
    {previewId && <ResourceState {...resource} retry={resource.reload} />}{action.error && <Notice error>{action.error}</Notice>}
  </Panel>;
}
