import {PlusVideoRequests} from './plus-video-requests';
import React,{useEffect,useState} from 'react';
import Taro from '@tarojs/taro';
import {Input,Text} from '@tarojs/components';
import type {DTO} from '../contracts/types';
import {client} from './runtime';
import {Action,Notice,Panel,ResourceState,useAction,useResource} from './base';
import {PlusRenderRequests} from './plus-render-requests';
import {PlusBatchRequests} from './plus-batch-requests';
declare const __YPCC_API_BASE__:string;

export function PlusConnections(){
  const [open,setOpen]=useState(false);
  return <><Action secondary onClick={()=>setOpen(v=>!v)}>{open?'收起电脑连接':'接续到电脑 Plus'}</Action>{open&&<ConnectionManager/>}</>;
}
function ConnectionManager(){
  const [code,setCode]=useState(''),[approval,setApproval]=useState<DTO<'PlusLinkApproval'>>(),[source,setSource]=useState('');
  const action=useAction(),list=useResource(async()=>{await client().login();return client().api.call('listPlusSessions');});
  const bindings=useResource(async()=>{await client().login();return client().api.call('listAccountBindings');});
  useEffect(()=>{list.reload();},[list.reload]);
  useEffect(()=>{bindings.reload();},[bindings.reload]);
  const binding=bindings.data?.items.find(value=>value.state==='ACTIVE'),sourceName=source&&binding?.binding_id===source?`已绑定的${binding.peer_platform==='alipay'?'支付宝':'抖音'}端`:'当前小程序';
  return <Panel><Text className='section-title'>电脑连接</Text><Text>在电脑打开一品成片 Plus，生成接续码后填到这里。只确认你自己电脑上显示的码。</Text>
    <Action secondary onClick={()=>void action.run(()=>client().host.copy(`${__YPCC_API_BASE__}/plus/`))}>复制电脑工作台地址</Action>
    <Input ariaLabel='电脑接续码' placeholder='8位接续码' maxlength={16} value={code} onInput={e=>{setCode(e.detail.value.toUpperCase().replace(/[\s-]/g,''));setApproval(undefined);}}/>
    <Action secondary disabled={action.busy||!/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$/.test(code)} onClick={()=>void action.run(async()=>{
      await client().login();setApproval(await client().api.call('inspectPlusLink',{body:{user_code:code}}));
    })}>查看接续请求</Action>
    {approval&&<><Notice>接续码 {approval.user_code} · {approval.state==='PENDING'?'等待你确认':approval.state==='APPROVED'?'已允许连接':'已拒绝'}。电脑可读取本人项目、领取原素材和保存编辑草稿，连接有效1小时；付款、退款和授权发布继续在原小程序操作。</Notice>
      <Text className='secondary'>{approval.can_prepare_render_plans?'本次还申请整理独立制作清单；每次正式制作仍需你回手机核对费用并付款。':'本次仅申请项目读取和编辑草稿，不含整理正式制作清单。'}</Text>
      {approval.can_edit_community_drafts&&<Text className='secondary'>本次申请预设编排：仅当前原账号草稿；创建、组合和保存，样例、授权及发布仍回原账号手机完成。不能选已绑定端作品。</Text>}{approval.account_binding_id&&<Text className='secondary'>本次作品来自已绑定的{approval.source_platform==='alipay'?'支付宝':'抖音'}端，解除绑定会同时关闭连接。</Text>}
      {approval.can_prepare_video_render_plans&&<Text className='secondary'>本次另申请整理原片视频剪辑清单，独立计价并回作品原渠道确认付款。</Text>}{approval.state==='PENDING'&&<><Text className='card-title'>选择本次接续的作品来源</Text>
        <Action secondary onClick={()=>setSource('')}>{!source?'已选 · ':''}当前小程序的作品</Action>
        {binding&&<Action secondary disabled={!!approval.can_edit_community_drafts} onClick={()=>setSource(binding.binding_id)}>{source===binding.binding_id?'已选 · ':''}已绑定的{binding.peer_platform==='alipay'?'支付宝':'抖音'}作品</Action>}
        <Text className='secondary'>当前来源：{sourceName}。电脑只进入这一个来源的项目；付费制作需回该来源的原小程序。</Text><ResourceState error={bindings.error} busy={bindings.busy} retry={bindings.reload}/>
        <Action disabled={action.busy||!!source&&(binding?.binding_id!==source||!!approval.can_edit_community_drafts)} onClick={()=>void action.run(async()=>{
        const checked=approval.user_code;const answer=await Taro.showModal({title:'允许这台电脑连接？',content:`请核对电脑显示的接续码为 ${checked}。来源：${sourceName}。允许读取本人项目与保存新编辑草稿${approval.can_prepare_render_plans?'、整理独立制作清单（付款回作品原渠道确认）':''}${approval.can_prepare_video_render_plans?'、整理原片视频剪辑清单（独立计价，付款回作品原渠道确认）':''}${approval.can_edit_community_drafts?'、编排社区预设草稿（样例、授权与发布回原账号手机）':''}，可在这里随时关闭。`,confirmText:'允许连接'});
        if(!answer.confirm)return;
        setApproval(await client().api.call('decidePlusLink',{body:{user_code:checked,decision:'APPROVE',...(source?{account_binding_id:source}:{})}}));list.reload();
      })}>允许这台电脑连接</Action><Action secondary disabled={action.busy} onClick={()=>void action.run(async()=>{
        setApproval(await client().api.call('decidePlusLink',{body:{user_code:approval.user_code,decision:'DENY'}}));
      })}>拒绝这次连接</Action></>}
    </>}
    {action.error&&<Notice error>{action.error}</Notice>}<ResourceState error={list.error} busy={list.busy} retry={list.reload}/>
    {list.data?.items.map(session=><Panel key={session.session_id}><Text className='card-title'>{session.platform==='alipay'?'支付宝':'抖音'} · {session.account_binding_id?'共享作品访问':'电脑'} {session.session_id.slice(-6)}</Text>
      <Text className='secondary'>到期：{new Date(session.expires_at).toLocaleString()}</Text><Action secondary disabled={action.busy} onClick={()=>void action.run(async()=>{
        await client().api.call('revokePlusSession',{params:{plus_session_id:session.session_id}});list.reload();
      })}>关闭这个电脑连接</Action></Panel>)}
    {!list.busy&&list.data&&!list.data.items.length&&<Text className='secondary'>目前没有有效电脑连接。确认后，可在电脑继续你的素材。</Text>}
    <Action secondary onClick={list.reload}>刷新连接记录</Action><PlusBatchRequests/><PlusRenderRequests/><PlusVideoRequests/>
  </Panel>;
}
