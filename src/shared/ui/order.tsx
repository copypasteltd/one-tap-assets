import React,{useState} from 'react';
import Taro,{useRouter} from '@tarojs/taro';
import {View,Text} from '@tarojs/components';
import {client} from './runtime';
import {orderActions,payOriginalOrder,cancelOriginalOrder,requestOriginalRefund} from '../client/order-actions';
import {Action,Notice,Panel,ResourceState,navigate,useAction,useResource} from './base';

export const paymentText:Record<string,string>={CREATED:'等待付款',PENDING:'正在确认付款',UNKNOWN:'付款结果待确认',CONFIRMED:'已确认付款',FAILED:'付款未完成',CANCELLED:'付款已取消'};
export const fulfillmentText:Record<string,string>={NOT_STARTED:'尚未开始制作',QUEUED:'等待制作',IN_PROGRESS:'正在制作',FAILED:'制作未完成',CANCELLED:'制作已取消',DELIVERED:'素材已交付'};
const stageText:Record<string,string>={ANALYZE:'整理商品信息',PLAN:'梳理素材内容',REPAIR_PLAN:'根据检查结果优化素材',PRODUCTION:'制作画面',POST:'后期制作',QC:'检查文件规格',REVIEW_FACTS:'核验商品与内容',REVIEW_STYLE:'检查风格与体验',DELIVER:'整理完整素材包'};
const refundText:Record<string,string>={REQUESTED:'退款申请已受理',PROCESSING:'退款处理中',UNKNOWN:'退款结果待确认',FAILED:'退款暂未完成',REJECTED:'退款申请需要进一步处理',REFUNDED:'原路退款已确认'};
export function Order(){
  const route=useRouter(),action=useAction();const [notice,setNotice]=useState('');
  const resource=useResource(async()=>{
    await client().login();const order=await client().api.call('getOrder',{params:{order_id:route.params.order_id??client().recover().orderId??''}});
    const stages=order.job_id?await client().api.call('listJobStages',{params:{job_id:order.job_id}}):null;
    const refund=order.refund_id?await client().api.call('getRefund',{params:{refund_id:order.refund_id}}):null;
    return {order,stages,refund};
  },d=>['CREATED','PENDING','UNKNOWN'].includes(d.order.payment_state)||['QUEUED','IN_PROGRESS'].includes(d.order.fulfillment_state)
    ||Boolean(d.refund&&['REQUESTED','PROCESSING','UNKNOWN'].includes(d.refund.state)));
  const order=resource.data?.order,allowed=order?orderActions(order,client().host.platform):null;
  const refresh=async(work:()=>Promise<void>)=>{try{await work();}finally{resource.reload();}};
  return <><ResourceState {...resource} retry={resource.reload}/>{order&&allowed&&<>
    <Text className='page-headline'>{order.fulfillment_state==='NOT_STARTED'?paymentText[order.payment_state]:fulfillmentText[order.fulfillment_state]}</Text>
    <Text className='price'>¥{(order.amount_fen/100).toFixed(2)}</Text><Text className='caption'>订单 {order.order_id}</Text>
    {order.payment_state!=='CONFIRMED'&&<Notice>{order.fulfillment_state==='CANCELLED'?'制作已取消，原交易仍会继续核对；若之后确认付款，将按原单处理退款。':'付款结果以服务端核验为准。返回或网络中断后，继续查询这笔原订单。'}</Notice>}
    {notice&&<Notice>{notice}</Notice>}
    {allowed.pay&&<Action disabled={action.busy} onClick={()=>void action.run(()=>refresh(async()=>{
      const result=await payOriginalOrder(client(),order.order_id);
      setNotice(result==='QUERY'?'原订单状态正在核对，请查看最新结果。':result==='CANCELLED'?'已返回原订单，可继续查看付款结果。':'已返回，正在等待服务端确认付款结果。');
    }))}>{action.busy?'正在查询原单…':'继续原单付款'}</Action>}
    {resource.data?.stages&&<Panel>{resource.data.stages.items.map(stage=><View className={`stage ${stage.state==='SUCCEEDED'?'stage-complete':''}`} key={stage.stage_id}>
      <Text>{stage.state==='SUCCEEDED'?'✓':stage.state==='RUNNING'?'◉':'○'}　{stageText[stage.name]??'整理素材'}</Text>
      <Text className='secondary'>{({FAILED:'未完成',SUCCEEDED:'完成',RUNNING:'进行中',CANCELLED:'已取消'} as Record<string,string>)[stage.state]??'等待'}</Text></View>)}</Panel>}
    {resource.data?.refund&&<Panel><Text className='card-title'>{refundText[resource.data.refund.state]??'正在查询退款'}</Text>
      <Text>原单退款 ¥{(resource.data.refund.amount_fen/100).toFixed(2)}</Text><Text className='caption'>退款编号 {resource.data.refund.refund_id}</Text>
      {resource.data.refund.state!=='REFUNDED'&&<Text className='secondary'>按原交易渠道处理，到账结果以平台回执为准。</Text>}</Panel>}
    {allowed.cancel&&<Action secondary disabled={action.busy} onClick={()=>void action.run(async()=>{
      const answer=await Taro.showModal({title:'取消这笔尚未开始制作的订单？',content:order.payment_state==='CONFIRMED'?'确认后停止排队，并按原交易渠道申请退款。退款到账以平台核验结果为准。':'确认后取消制作，平台会继续核对原交易；如果之后确认付款，会按原渠道处理退款。',confirmText:'确认取消',cancelText:'保留订单'});
      if(answer.confirm)await refresh(async()=>{await cancelOriginalOrder(client(),order.order_id);setNotice('取消请求已处理，请查看原订单和退款的最新状态。');});
    })}>{order.payment_state==='CONFIRMED'?'取消排队并申请退款':'取消这笔订单'}</Action>}
    {allowed.refund&&<Action secondary disabled={action.busy} onClick={()=>void action.run(async()=>{
      const answer=await Taro.showModal({title:'申请这笔原订单退款？',content:'按原单实付金额和原交易渠道处理，提交申请不代表已到账。',confirmText:'确认申请',cancelText:'暂不申请'});
      if(answer.confirm)await refresh(async()=>{await requestOriginalRefund(client(),order.order_id);setNotice('退款申请已提交，请持续查询原单结果。');});
    })}>申请原路退款</Action>}
    {order.fulfillment_state==='DELIVERED'&&<Action onClick={()=>navigate('pack',{order_id:order.order_id})}>查看完整素材包</Action>}
    {action.error&&<Notice error>{action.error}</Notice>}
    <Action secondary disabled={action.busy} onClick={resource.reload}>查询原单最新状态</Action>
    <Action secondary onClick={()=>navigate('help',{order_id:order.order_id})}>{['IN_PROGRESS','DELIVERED'].includes(order.fulfillment_state)?'订单售后与问题反馈':'订单问题反馈'}</Action>
  </>}</>;
}
