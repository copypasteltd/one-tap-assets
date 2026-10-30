import React,{useEffect} from 'react';
import {Text} from '@tarojs/components';
import type {DTO} from '../contracts/types';
import {client} from './runtime';
import {Action,Panel,ResourceState,navigate,usePagedResource,useResource} from './base';

export function PlusRenderRequests(){
  const list=usePagedResource(async cursor=>{await client().login();return client().api.call('listPlusRenderPlans',{query:{limit:20,cursor}});},x=>x.request_id);
  useEffect(()=>{list.reload();},[list.reload]);
  return <Panel><Text className='section-title'>电脑制作清单</Text><Text>电脑仅整理独立制作内容。请在这里核对规格和完整费用，再主动付款；原素材与原订单继续保留。</Text>
    <ResourceState busy={list.busy} error={list.error} retry={list.reload}/>
    {list.items.map(item=><Panel key={item.request_id}><Text className='card-title'>{item.settings.title||'进阶图片制作'} · 草稿版本{item.draft_revision}</Text>
      <Text>{item.settings.canvas.width}×{item.settings.canvas.height} · 1张图片及配套文案 · 独立计价¥{(item.price_fen/100).toFixed(2)}</Text>
      <Text className='secondary'>{item.order?'原渠道订单已建立':item.plan.state==='READY'?'内容清单已就绪':item.plan.state==='PLANNING'||item.plan.state==='VALIDATING'?'正在整理内容':'内容清单未完成'}</Text>
      <Action secondary onClick={()=>item.order?navigate('order',{order_id:item.order.order_id}):navigate('confirm',{plan_id:item.plan.plan_id})}>{item.order?'继续原渠道订单':'打开这版制作清单'}</Action>
    </Panel>)}
    {!list.busy&&list.loaded&&!list.items.length&&<Text className='secondary'>还没有电脑提交的制作清单。</Text>}
    {list.next&&<Action secondary disabled={list.busy} onClick={list.more}>更多电脑制作清单</Action>}<Action secondary onClick={list.reload}>刷新电脑制作清单</Action>
  </Panel>;
}
export function PlusPlanDetails({plan,onReady}:{plan:DTO<'Plan'>;onReady(value:boolean):void}){
  const resource=useResource(()=>client().api.call('getPlusRenderPlan',{params:{request_id:plan.plus_render_request_id!}}));
  useEffect(()=>{resource.reload();},[resource.reload]);
  const value=resource.data;useEffect(()=>{onReady(!!value&&!resource.error&&value.plan.plan_id===plan.plan_id);},[value,resource.error,plan.plan_id,onReady]);
  return <Panel><Text className='section-title'>电脑确认的独立制作版本</Text><ResourceState {...resource} retry={resource.reload}/>
    {value&&<><Text>草稿版本{value.draft_revision} · {value.settings.canvas.width}×{value.settings.canvas.height}像素</Text>
      <Text>裁切：左{Math.round(value.settings.crop.x*100)}%，上{Math.round(value.settings.crop.y*100)}%，宽{Math.round(value.settings.crop.width*100)}%，高{Math.round(value.settings.crop.height*100)}%</Text>
      {value.settings.brand&&<Text>用户补充品牌：{value.settings.brand}</Text>}{value.settings.facts.map((fact,i)=><Text key={i}>待核对事实：{fact}</Text>)}
      <Text className='secondary'>补充信息不会自动成为识别事实，仍须事实与风格复核。新制作单独报价和付款，保留原素材及原订单权益。</Text></>}
  </Panel>;
}
