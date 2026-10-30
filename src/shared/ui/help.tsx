import React,{useEffect,useRef,useState} from 'react';
import {useDidHide,useRouter} from '@tarojs/taro';
import {View,Text,Button,Textarea,Image} from '@tarojs/components';
import type {DTO} from '../contracts/types';
import type {LocalPhoto} from '../platform/ports';
import {ClientError} from '../client/api';
import {SupportSubmission,supportCategories,ticketStates} from '../client/support';
import {client} from './runtime';
import {Action,More,Notice,Panel,ResourceState,navigate,useAction,usePagedResource,useResource} from './base';

export function Help(){
  const route=useRouter();const orderId=route.params.order_id;
  const articles=useResource(()=>client().api.call('listHelpArticles'));
  const account=useResource(async()=>{
    await client().login();const buyer=client().api.userId;
    const order=orderId?await client().api.call('getOrder',{params:{order_id:orderId}}):null;
    if(client().api.userId!==buyer||order&&order.order_id!==orderId)throw new ClientError('ACCOUNT_CHANGED','账户或订单已变化，请重新查看自己的记录');
    return {buyer,order};
  });
  return <><Text className='page-headline'>我们一起解决</Text>
    <ResourceState {...articles} retry={articles.reload}/>{articles.data?.items.map(article=><Panel key={article.article_id}><Text className='card-title'>{article.title}</Text><Text>{article.body}</Text></Panel>)}
    <ResourceState {...account} retry={account.reload}/>{!account.busy&&!account.error&&account.data?.buyer===client().api.userId&&account.data?.buyer&&
      <SupportCenter key={`${account.data.buyer}:${orderId??'all'}`} buyer={account.data.buyer} order={account.data.order}/>}
  </>;
}
function SupportCenter({buyer,order}:{buyer:string;order:DTO<'Order'>|null}){
  const action=useAction(),alive=useRef(true);const [category,setCategory]=useState<DTO<'TicketRequest'>['category']>('OTHER');
  const [text,setText]=useState(''),[photos,setPhotos]=useState<LocalPhoto[]>([]),[locked,setLocked]=useState(false),[sent,setSent]=useState<DTO<'Ticket'>>();
  const [detail,setDetail]=useState<DTO<'Ticket'>>();const [view,setView]=useState<'all'|'order'>(order?'order':'all');
  const scope=()=>{if(!alive.current||client().api.userId!==buyer)throw new ClientError('ACCOUNT_CHANGED','请回到当前账户的原反馈记录继续');};
  const submission=useRef<SupportSubmission>();
  if(order&&!submission.current)submission.current=new SupportSubmission(client(),order.order_id,scope);
  useEffect(()=>()=>{alive.current=false;},[]);useDidHide(()=>{alive.current=false;});
  const history=usePagedResource(async cursor=>{scope();const result=await client().api.call('listSupportTickets',{query:{limit:20,cursor}});scope();return result;},t=>t.ticket_id);
  const records=history.items.filter(t=>view==='all'||t.order_id===order?.order_id);
  if(client().api.userId!==buyer)return <Notice>账户已变化，请重新打开帮助页查看自己的反馈记录。</Notice>;
  return <>{order?<Panel><Text className='card-title'>反馈这笔订单的问题</Text>
      <Text className='caption'>关联订单：{order.order_id}</Text><Text className='secondary'>无需升级或分享。反馈受理后，可在下方查看处理状态。</Text>
      {sent?<Notice>已受理，反馈编号：{sent.ticket_id}。受理不代表已退款或完成修复，请以订单和处理状态为准。</Notice>:<>
        <View className='filters'>{(Object.keys(supportCategories) as DTO<'TicketRequest'>['category'][]).map(value=><Button className={`filter ${category===value?'selected':''}`} key={value} disabled={action.busy||locked} onClick={()=>setCategory(value)}>{supportCategories[value]}</Button>)}</View>
        {category==='PRODUCT_ERROR'&&<Notice>请指出商品或文字哪里不一致。平台制作错误走核实纠错，不占用一次自选小修改；受理后仍需核实。</Notice>}
        <Textarea className='feedback-input' maxlength={2000} disabled={action.busy||locked} value={text} onInput={e=>setText(e.detail.value)} placeholder='描述遇到的问题，请勿填写密码、证件号码或完整支付凭证'/>
        <View className='support-photos'>{photos.map((photo,index)=><View className='support-photo' key={`${photo.sha256}:${index}`}><Image className='support-evidence-image' src={photo.path} mode='aspectFill'/><Button className='filter' disabled={action.busy||locked} onClick={()=>setPhotos(old=>old.filter((_,i)=>i!==index))}>移除图片 {index+1}</Button></View>)}</View>
        <Action secondary disabled={action.busy||locked||photos.length>=5} onClick={()=>void action.run(async()=>{scope();const picked=await client().host.choosePhotos({source:'album',count:5-photos.length});scope();setPhotos(old=>[...old,...picked].slice(0,5));})}>添加证明图片（{photos.length}/5）</Action>
        <Text className='caption'>图片可选，最多5张，每张不超过10MB；请遮住与问题无关的个人信息。</Text>
        {locked&&<Notice>这次反馈正在等待确认，内容已保留。可继续原提交或查询下方记录，不会重新下单或付款。</Notice>}
        <Action disabled={action.busy||!text.trim()} onClick={()=>void action.run(async()=>{
          scope();try{const pending=submission.current!.submit({category,message:text,photos});setLocked(submission.current!.pending);const ticket=await pending;scope();setSent(ticket);setPhotos([]);history.reload();}
          finally{if(alive.current&&client().api.userId===buyer)setLocked(submission.current!.pending);}
        })}>{action.busy?'正在提交…':locked?'继续提交这次反馈':'提交问题'}</Action>
      </>}
      <Action secondary disabled={action.busy} onClick={()=>navigate('order',{order_id:order.order_id})}>查看原订单与退款</Action>
    </Panel>:<Notice>从原订单或素材领取页进入，可反馈具体问题；下面可查看本账户已有记录。</Notice>}
    {action.error&&<Notice error>{action.error}</Notice>}
    <Text className='section-title'>我的反馈记录</Text>{order&&<View className='filters'><Button className={`filter ${view==='order'?'selected':''}`} onClick={()=>setView('order')}>这笔订单</Button><Button className={`filter ${view==='all'?'selected':''}`} onClick={()=>setView('all')}>全部订单</Button></View>}
    <Action secondary disabled={history.busy||action.busy} onClick={()=>{setDetail(undefined);history.reload();}}>刷新反馈记录</Action><ResourceState {...history} retry={history.reload}/>
    {history.loaded&&!records.length&&<Text className='secondary'>{history.next?'当前这页暂无匹配记录，可继续加载。':'还没有匹配的反馈记录。'}</Text>}
    {records.map(ticket=><Panel key={ticket.ticket_id}><View className='section-title'><Text>{supportCategories[ticket.category as keyof typeof supportCategories]??'订单问题'}</Text><Text>{ticketStates[ticket.state]??'状态待查询'}</Text></View>
      <Text className='caption'>反馈编号：{ticket.ticket_id}</Text><Text className='caption'>关联订单：{ticket.order_id}</Text><Text className='caption'>更新于 {new Date(ticket.updated_at).toLocaleString()}</Text>
      <Action secondary disabled={action.busy} onClick={()=>void action.run(async()=>{scope();setDetail(undefined);const current=await client().api.call('getSupportTicket',{params:{ticket_id:ticket.ticket_id}});scope();if(current.ticket_id!==ticket.ticket_id||current.order_id!==ticket.order_id)throw new ClientError('SUPPORT_RESULT_INVALID','反馈记录已变化，请重新查询');setDetail(current);})}>查询最新处理状态</Action>
      {detail?.ticket_id===ticket.ticket_id&&<><Notice>最新状态：{ticketStates[detail.state]??'请稍后查询'}。{detail.state==='RESOLVED'?'处理记录已更新，退款与素材请查询原订单。':'如需查看退款或领取素材，请进入关联订单。'}</Notice>
        {detail.response&&<View className='support-reply'><Text className='card-title'>客服回复</Text><Text>{detail.response.message}</Text><Text className='caption'>回复于 {new Date(detail.response.updated_at).toLocaleString()}</Text></View>}</>}
      <Action secondary disabled={action.busy} onClick={()=>navigate('order',{order_id:ticket.order_id})}>查看关联订单</Action>
    </Panel>)}<More {...history}/>
  </>;
}
