import React,{useEffect,useMemo,useState} from 'react';
import Taro from '@tarojs/taro';
import {Input,Text} from '@tarojs/components';
import type {DTO} from '../contracts/types';
import {ApiClient,ClientError} from '../client/api';
import {client} from './runtime';
import {Action,More,Notice,Panel,ResourceState,useAction,usePagedResource,useResource} from './base';

declare const __YPCC_API_BASE__:string;
const platformName=(platform:DTO<'Platform'>)=>platform==='alipay'?'支付宝':'抖音';
const validCode=(value:string)=>/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$/.test(value);
const requestState:Record<DTO<'AccountBindingRequest'>['state'],string>={PENDING:'等待另一端加入',CLAIMED:'请发起端核对确认码',BOUND:'已完成绑定',CANCELLED:'已取消',REJECTED:'另一端已撤回',EXPIRED:'已过期，请重新发起'};

export function AccountBindings(){
  const [open,setOpen]=useState(false);
  return <><Action secondary onClick={()=>setOpen(value=>!value)}>{open?'收起两端账号绑定':'绑定支付宝与抖音账号'}</Action>{open&&<BindingManager/>}</>;
}
function BindingManager(){
  const [code,setCode]=useState(''),[candidate,setCandidate]=useState<DTO<'AccountBindingRequest'>>(),[recent,setRecent]=useState<DTO<'AccountBindingRequest'>>();
  const action=useAction(),resource=useResource(async()=>{
    await client().login();const [bindings,requests]=await Promise.all([client().api.call('listAccountBindings'),client().api.call('listAccountBindingRequests')]);
    return{bindings,requests};
  },value=>value.requests.items.length>0);
  useEffect(()=>{resource.reload();},[resource.reload]);
  const requests=resource.data?.requests.items??[],active=resource.data?.bindings.items.find(value=>value.state==='ACTIVE');
  const visible=(recent&&!requests.some(value=>value.request_id===recent.request_id)?[recent,...requests]:requests).map((value):DTO<'AccountBindingRequest'>=>
    ['PENDING','CLAIMED'].includes(value.state)&&Date.parse(value.expires_at)<=Date.now()?{...value,state:'EXPIRED'}:value);
  async function decide(request:DTO<'AccountBindingRequest'>,decision:DTO<'AccountBindingDecisionRequest'>['decision']){
    if(decision==='CONFIRM'){
      const answer=await Taro.showModal({title:'两端确认码一致？',content:`请亲自在另一端核对确认码 ${request.verification_code}。确认后，两端可以领取本人作品并接续电脑编辑；订单、付款与退款仍由原渠道负责。`,confirmText:'核对一致'});
      if(!answer.confirm)return;
    }
    setRecent(await client().api.call('decideAccountBindingRequest',{params:{request_id:request.request_id},body:{decision,...(decision==='CONFIRM'?{verification_code:request.verification_code!}:{})}}));resource.reload();
  }
  return <Panel><Text className='section-title'>本人两端账号</Text><Notice>需要在支付宝、抖音两端分别登录并确认。绑定后可共享本人作品、编辑草稿，原订单与付费权益继续留在原平台。每端同时只能绑定一个另一端账号。</Notice>
    {!active&&<><Action disabled={action.busy} onClick={()=>void action.run(async()=>{await client().login();setRecent(await client().api.call('createAccountBindingRequest',{body:{}}));resource.reload();})}>本端发起绑定</Action>
      <Text className='secondary'>或在本端输入你自己另一端小程序显示的绑定码。</Text>
      <Input ariaLabel='另一端绑定码' placeholder='8位绑定码' maxlength={16} value={code} onInput={event=>{setCode(event.detail.value.toUpperCase().replace(/[\s-]/g,''));setCandidate(undefined);}}/>
      <Action secondary disabled={action.busy||!validCode(code)} onClick={()=>void action.run(async()=>{await client().login();setCandidate(await client().api.call('inspectAccountBindingCode',{body:{user_code:code}}));})}>查看另一端邀请</Action>
      {candidate&&<Panel><Text>发起端：{platformName(candidate.origin_platform)} · {requestState[candidate.state]}</Text><Text className='secondary'>到期：{new Date(candidate.expires_at).toLocaleTimeString()}，查看邀请尚未共享任何作品。</Text>
        {candidate.role==='CANDIDATE'&&candidate.state==='PENDING'&&<Action disabled={action.busy} onClick={()=>void action.run(async()=>{
          const answer=await Taro.showModal({title:'这是你本人的另一端账号？',content:'仅加入你本人发起的邀请。加入后仍需回发起端核对确认码，才会共享作品。',confirmText:'本人加入'});if(!answer.confirm)return;
          setRecent(await client().api.call('claimAccountBindingRequest',{body:{user_code:code}}));setCandidate(undefined);resource.reload();
        })}>我是本人，加入绑定</Action>}</Panel>}
    </>}
    {visible.map(request=><Panel key={request.request_id}><Text className='card-title'>{requestState[request.state]}</Text><Text className='secondary'>{platformName(request.origin_platform)}发起 · 截止{new Date(request.expires_at).toLocaleTimeString()}</Text>
      {request.role==='ORIGIN'&&request.state==='PENDING'&&<><Text className='price'>{request.user_code}</Text><Action secondary onClick={()=>void action.run(()=>client().host.copy(request.user_code!))}>复制绑定码，去另一端输入</Action></>}
      {request.state==='CLAIMED'&&<><Text>双方确认码：{request.verification_code}</Text><Text className='secondary'>请亲自核对两端显示的确认码。由发起端完成最后确认。</Text>
        {request.role==='ORIGIN'&&<Action disabled={action.busy} onClick={()=>void action.run(()=>decide(request,'CONFIRM'))}>两端一致，完成绑定</Action>}</>}
      {['PENDING','CLAIMED'].includes(request.state)&&<Action secondary disabled={action.busy} onClick={()=>void action.run(()=>decide(request,request.role==='ORIGIN'?'CANCEL':'REJECT'))}>{request.role==='ORIGIN'?'取消这次绑定':'撤回本端加入'}</Action>}
    </Panel>)}
    {resource.data?.bindings.items.map(binding=><Panel key={binding.binding_id}><Text className='card-title'>{platformName(binding.peer_platform)} · {binding.state==='ACTIVE'?'已绑定':'已解除'}</Text><Text className='secondary'>建立于{new Date(binding.created_at).toLocaleString()}</Text>
      {binding.state==='ACTIVE'&&<Action secondary disabled={action.busy} onClick={()=>void action.run(async()=>{
        const answer=await Taro.showModal({title:'解除两端账号绑定？',content:'两端的共享作品入口、由本绑定建立的电脑连接及其领取链接立即失效。已保存的文件无法远程删除；原渠道订单和退款记录仍保留。',confirmText:'解除绑定',confirmColor:'#B83232'});if(!answer.confirm)return;
        await client().api.call('revokeAccountBinding',{params:{binding_id:binding.binding_id}});setRecent(undefined);resource.reload();
      })}>解除这个绑定</Action>}
    </Panel>)}
    <ResourceState error={resource.error} busy={resource.busy} retry={resource.reload}/>{action.error&&<Notice error>{action.error}</Notice>}<Action secondary onClick={resource.reload}>刷新绑定进度</Action>
  </Panel>;
}

export function BoundProjects(){
  const [open,setOpen]=useState(false);
  return <><Action secondary onClick={()=>setOpen(value=>!value)}>{open?'收起另一端作品':'查看已绑定端作品'}</Action>{open&&<BoundProjectEntry/>}</>;
}
function BoundProjectEntry(){
  const [grant,setGrant]=useState<DTO<'PlusBrowserSession'>>(),action=useAction();
  const resource=useResource(async()=>{await client().login();return client().api.call('listAccountBindings');});
  useEffect(()=>{resource.reload();},[resource.reload]);
  const binding=resource.data?.items.find(value=>value.state==='ACTIVE');
  return <Panel><Text className='section-title'>另一端作品</Text><ResourceState error={resource.error} busy={resource.busy} retry={resource.reload}/>
    {!resource.busy&&!binding&&<Notice>尚未绑定另一端账号。请到“账户设置”中由支付宝与抖音两端分别确认。</Notice>}
    {binding&&!grant&&<><Notice>来源：{platformName(binding.peer_platform)}。可领取已交付素材，电脑 Plus 可继续编辑。新增付费制作、查单与退款请回作品原渠道处理。</Notice>
      <Action disabled={action.busy} onClick={()=>void action.run(async()=>{setGrant(await client().api.call('createBoundProjectSession',{params:{binding_id:binding.binding_id}}));})}>打开{platformName(binding.peer_platform)}作品</Action></>}
    {grant&&<BoundLibrary key={grant.connection.session_id} grant={grant} close={()=>setGrant(undefined)}/>}{action.error&&<Notice error>{action.error}</Notice>}
  </Panel>;
}
function BoundLibrary({grant,close}:{grant:DTO<'PlusBrowserSession'>;close():void}){
  const [expired,setExpired]=useState(false),[pack,setPack]=useState<DTO<'Deliverables'>>(),[notice,setNotice]=useState(''),action=useAction();
  const nativeUser=useMemo(()=>client().api.userId,[]);
  const api=useMemo(()=>{const value=new ApiClient(__YPCC_API_BASE__,client().host.transport,()=>setExpired(true));value.setSession(grant);return value;},[grant]);
  const resource=usePagedResource(cursor=>{if(client().api.userId!==nativeUser)throw new ClientError('ACCOUNT_CHANGED','本端账号已变化，请关闭后重新打开',401);return api.call('listOrders',{query:{limit:20,cursor}});},value=>value.order_id);
  useEffect(()=>{resource.reload();return()=>{void api.call('revokePlusSession',{params:{plus_session_id:grant.connection.session_id}}).catch(()=>{}).finally(()=>api.setSession(null));};},[api,grant.connection.session_id,resource.reload]);
  async function save(item:DTO<'Deliverable'>){
    if(item.kind==='copy'){await client().host.copy(item.text??'');setNotice('文案已复制');return;}
    const link=await api.call('createDownloadLink',{params:{deliverable_id:item.deliverable_id},key:`bound:${grant.connection.session_id}:${item.deliverable_id}:${Date.now()}`});
    const path=await client().host.download(link),result=await client().host.save(path,item.kind);setNotice(result==='SAVED'?'已收到设备保存成功的结果。':'设备尚未确认保存结果，请到相册检查后再试。');
  }
  return <><Text className='card-title'>{platformName(grant.connection.platform)}作品 · 临时访问至{new Date(grant.expires_at).toLocaleTimeString()}</Text>
    <Action secondary onClick={close}>关闭另一端作品</Action>{expired?<Notice error>连接已到期或绑定已解除，请关闭后重新打开。</Notice>:<>
      <ResourceState error={resource.error} busy={resource.busy} retry={resource.reload}/>{resource.loaded&&!resource.items.length&&<Text className='secondary'>另一端尚无作品订单。</Text>}
      {resource.items.map(order=><Panel key={order.order_id}><Text className='card-title'>{order.fulfillment_state==='DELIVERED'?'已交付作品':'制作或原订单记录'}</Text><Text className='secondary'>{new Date(order.created_at).toLocaleString()} · 原渠道{platformName(order.channel)}</Text>
        {order.fulfillment_state==='DELIVERED'?<Action secondary disabled={action.busy} onClick={()=>void action.run(async()=>{setPack(await api.call('getDeliverables',{params:{order_id:order.order_id}}));setNotice('');})}>查看另一端素材包</Action>:<Text className='secondary'>请回原渠道查询制作与交易进度。</Text>}</Panel>)}<More {...resource}/>
      {pack&&<Panel><Text className='card-title'>另一端素材清单</Text>{pack.items.map(item=><Panel key={item.deliverable_id}><Text>{item.file_name||item.slot_id} · {item.kind==='image'?'图片':item.kind==='video'?'视频':'文案'}</Text>
        {item.kind==='copy'&&<Text>{item.text}</Text>}<Action secondary disabled={action.busy} onClick={()=>void action.run(()=>save(item))}>{item.kind==='copy'?'复制这条文案':'保存这份素材到相册'}</Action></Panel>)}</Panel>}
    </>}{notice&&<Notice>{notice}</Notice>}{action.error&&<Notice error>{action.error}</Notice>}</>;
}
