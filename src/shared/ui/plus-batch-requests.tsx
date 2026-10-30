import React,{useEffect,useState} from 'react';
import {Text} from '@tarojs/components';
import {plusBatchPending,plusRenderStatus} from '../domain/plus-batch-status';
import {client} from './runtime';
import {Action,Panel,ResourceState,navigate,usePagedResource,useResource} from './base';

export function PlusBatchRequests(){
  const [selected,setSelected]=useState('');
  const list=usePagedResource(async cursor=>{await client().login();return client().api.call('listPlusRenderBatches',{query:{limit:10,cursor}});},x=>x.batch_id);
  useEffect(()=>{list.reload();},[list.reload]);
  return <Panel><Text className='section-title'>批量制作记录</Text><Text>电脑一次整理多件商品。每件独立核对清单、费用与付款，某件未完成时，其他商品可继续。</Text>
    <ResourceState busy={list.busy} error={list.error} retry={list.reload}/>
    {list.items.map(batch=><Panel key={batch.batch_id}><Text className='card-title'>{new Date(batch.created_at).toLocaleString()} · {batch.item_count}份选择</Text>
      <Text className='secondary'>{batch.prepared_count}份独立清单 · {batch.preparation_failed_count}份未完成 · {batch.removed_count}份已移除</Text>
      <Action secondary onClick={()=>setSelected(value=>value===batch.batch_id?'':batch.batch_id)}>{selected===batch.batch_id?'收起这批':'逐件核对这批'}</Action>
      {selected===batch.batch_id&&<BatchDetails key={batch.batch_id} batchId={batch.batch_id}/>}
    </Panel>)}
    {!list.busy&&list.loaded&&!list.items.length&&<Text className='secondary'>还没有电脑整理的批次。</Text>}
    {list.next&&<Action secondary disabled={list.busy} onClick={list.more}>更多批次</Action>}<Action secondary onClick={list.reload}>刷新批量制作记录</Action>
  </Panel>;
}
function BatchDetails({batchId}:{batchId:string}){
  const resource=useResource(()=>client().api.call('getPlusRenderBatch',{params:{batch_id:batchId}}),plusBatchPending);
  useEffect(()=>{resource.reload();},[resource.reload]);
  return <><ResourceState busy={resource.busy} error={resource.error} retry={resource.reload}/>{resource.data?.items.map(item=><Panel key={item.position}>
    <Text className='card-title'>第{item.position}件 · {item.render?.settings.title||'独立图片制作'}</Text>
    <Text>{item.render?plusRenderStatus(item.render):item.state==='SOURCE_REMOVED'?'原商品或素材已移除':'这件尚未建立清单'}</Text>
    {item.render&&<><Text>草稿版本{item.render.draft_revision} · {item.render.settings.canvas.width}×{item.render.settings.canvas.height} · ¥{(item.render.price_fen/100).toFixed(2)}</Text>
      <Action secondary disabled={!item.render.order&&item.render.plan.state!=='READY'} onClick={()=>item.render!.order?navigate('order',{order_id:item.render!.order.order_id}):navigate('confirm',{plan_id:item.render!.plan.plan_id})}>{item.render.order?'继续这件的原渠道订单':'核对这件的清单与费用'}</Action></>}
    {item.failure&&<Text className='secondary'>{item.failure.message}。可在电脑刷新草稿，再重新选择这件。其他商品按各自记录继续。</Text>}
  </Panel>)}<Action secondary onClick={resource.reload}>刷新本批次进度</Action></>;
}
