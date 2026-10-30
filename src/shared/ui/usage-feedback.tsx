import React,{useEffect,useRef,useState} from 'react';
import {View,Text,Button} from '@tarojs/components';
import type {DTO} from '../contracts/types';
import {usageFeedback} from '../client/usage-feedback';
import {client} from './runtime';
import {Panel,Notice,Action} from './base';

const choices:{value:DTO<'UsageChoice'>;label:string}[]=[{value:'PLANNED_USE',label:'准备使用'},{value:'USED',label:'已经用上'},{value:'NEEDS_ADJUSTMENT',label:'还需调整'}];
export function UsageFeedback({orderId,buyer}:{orderId:string;buyer:string}){
  const epoch=useRef(0),active=useRef(true);
  const [record,setRecord]=useState<DTO<'UsageFeedback'>>(),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const current=(version:number)=>active.current&&version===epoch.current&&client().api.userId===buyer;
  async function load(){const version=++epoch.current;setBusy(true);setError('');
    try{const result=await client().api.call('getUsageFeedback',{params:{order_id:orderId}});if(current(version))setRecord(usageFeedback(result,orderId));}
    catch(e){if(current(version))setError(e instanceof Error?e.message:'反馈暂时无法读取，可稍后再试');}
    finally{if(current(version))setBusy(false);}
  }
  async function choose(choice:DTO<'UsageFeedback'>['choice']){
    if(!record||busy||error||client().api.userId!==buyer)return;
    const version=++epoch.current;setBusy(true);setError('');
    try{const result=await client().api.call('setUsageFeedback',{params:{order_id:orderId},body:{choice,expected_revision:record.revision}});
      if(current(version))setRecord(usageFeedback(result,orderId));}
    catch(e){if(current(version))setError(e instanceof Error?`${e.message}。请先重新读取，再决定是否更改。`:'未收到确认，请先重新读取反馈');}
    finally{if(current(version))setBusy(false);}
  }
  useEffect(()=>{active.current=true;void load();return()=>{active.current=false;epoch.current++;};},[orderId,buyer]);
  return <Panel><Text className='card-title'>这套素材，用得怎么样？</Text>
    <Text className='secondary'>自愿反馈，不影响领取或保存。可以更改，也可以撤回。</Text>
    <View className='filters'>{choices.map(choice=><Button key={choice.value} className={`filter${record?.choice===choice.value?' active':''}`}
      disabled={busy||!!error||!record} onClick={()=>void choose(choice.value)}>{record?.choice===choice.value?'✓ ':''}{choice.label}</Button>)}</View>
    {record?.choice&&<Action secondary disabled={busy||!!error} onClick={()=>void choose(null)}>撤回使用反馈</Action>}
    {busy&&<Text className='caption'>正在核对反馈…</Text>}
    {error&&<><Notice error>{error}</Notice><Action secondary disabled={busy} onClick={()=>void load()}>重新读取反馈</Action></>}
    {record&&!busy&&!error&&<Text className='caption'>{record.choice?'已记录你的选择。':'尚未提供使用反馈。'}</Text>}
  </Panel>;
}
