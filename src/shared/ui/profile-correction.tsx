import React,{useEffect,useRef,useState} from 'react';
import {useDidHide,useDidShow} from '@tarojs/taro';
import {View,Text,Button,Textarea} from '@tarojs/components';
import {client} from './runtime';
import {ClientError} from '../client/api';
import {correctionFields,photoRoleLabels,correctionLimit,prepareCorrection,submitCorrection,type CorrectionDraft,type CorrectionContext,type PreparedCorrection} from '../client/profile-correction';
import {Action,Notice,Panel,message} from './base';

export function ProfileCorrection({context,onUpdated,onBlocked,onReload}:{context:CorrectionContext;onUpdated():void;onBlocked(value:boolean):void;onReload():void}){
  const [open,setOpen]=useState(false),[field,setField]=useState<CorrectionDraft['field']>('name'),[value,setValue]=useState(context.profile.name??'');
  const [photos,setPhotos]=useState<string[]>([]),[pending,setPending]=useState<PreparedCorrection>(),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const epoch=useRef(0),lock=useRef(false),controller=useRef<AbortController>(),account=useRef(client().api.userId),mounted=useRef(true);
  const clear=()=>{epoch.current++;controller.current?.abort();setOpen(false);setValue('');setPhotos([]);setPending(undefined);setBusy(false);setError('');onBlocked(false);};
  useDidHide(clear);useDidShow(()=>{if(account.current!==client().api.userId){account.current=client().api.userId;clear();onReload();}});
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;epoch.current++;controller.current?.abort();onBlocked(false);};},[]);
  const select=(next:CorrectionDraft['field'])=>{setField(next);setValue(next==='name'?context.profile.name??'':next==='category'?context.profile.category??'':next==='photo_role'?'WHOLE':'');setPhotos([]);setError('');};
  const submit=async()=>{if(lock.current)return;lock.current=true;const generation=++epoch.current;controller.current=new AbortController();setBusy(true);setError('');
    try{
      const intent=pending??prepareCorrection(client(),context,{field,value,evidence_asset_ids:photos});setPending(intent);onBlocked(true);
      await submitCorrection(client(),intent,controller.current.signal);
      if(mounted.current&&epoch.current===generation){clear();onUpdated();}
    }catch(reason){if(mounted.current&&epoch.current===generation){setError(reason instanceof ClientError&&reason.code==='NETWORK_UNKNOWN'?'这次纠错的回执尚未确认，请核对原提交':message(reason));
      if(reason instanceof ClientError&&['INPUT_VERSION_CHANGED','REVISION_CONFLICT','ACCOUNT_CHANGED','EVIDENCE_SCOPE_INVALID','CORRECTION_VALUE_INVALID','EVIDENCE_REQUIRED','CORRECTION_CAPACITY_REACHED','CORRECTION_UNCHANGED','INVALID_PHOTO_ROLE'].includes(reason.code)){setPending(undefined);onBlocked(false);}
    }}finally{lock.current=false;if(mounted.current&&epoch.current===generation)setBusy(false);}
  };
  if(!open)return <Action secondary onClick={()=>{select('name');setOpen(true);}}>识别有误？补充一处纠错</Action>;
  return <Panel><Text className='card-title'>只改需要纠正的地方</Text><Text className='secondary'>可选操作，不用逐项填表。纠错用于后续制作，已付款订单保留原合同。</Text>
    {!pending&&<><View className='filters'>{(Object.keys(correctionFields) as CorrectionDraft['field'][]).map(key=><Button key={key} className={`filter ${field===key?'selected':''}`} disabled={busy} onClick={()=>select(key)}>{correctionFields[key]}</Button>)}</View>
      {field==='photo_role'?<View className='filters'>{(Object.keys(photoRoleLabels) as (keyof typeof photoRoleLabels)[]).map(role=><Button key={role} className={`filter ${value===role?'selected':''}`} disabled={busy} onClick={()=>setValue(role)}>{photoRoleLabels[role]}</Button>)}</View>
        :<><Text className='caption'>{correctionFields[field]} · 最多{correctionLimit(field)}字</Text><Textarea className='feedback-input' maxlength={correctionLimit(field)} value={value} onInput={event=>setValue(event.detail.value)}/></>}
      <Text className='caption'>{['name','category'].includes(field)?'可选：关联依据照片':'选择能看到这项内容的原照片'}</Text><View className='filters'>{context.profile.photo_roles.map((photo,index)=><Button key={photo.asset_id} className={`filter ${photos.includes(photo.asset_id)?'selected':''}`} disabled={busy}
        onClick={()=>setPhotos(old=>old.includes(photo.asset_id)?old.filter(id=>id!==photo.asset_id):[...old,photo.asset_id])}>照片{index+1} · {photoRoleLabels[photo.role]}{photos.includes(photo.asset_id)?' · 已选':''}</Button>)}</View></>}
    {['observation','label_text'].includes(field)&&<Notice>你的补充会保留“用户纠错”来源，仍需商品证据和后续复核，不会直接当作模型已观察的事实。</Notice>}
    {pending&&<Notice>正在核对这次“{correctionFields[pending.body.field]}”提交。回执未确认时沿用原提交，不会再新增一份。</Notice>}
    {error&&<Notice error>{error}</Notice>}
    <Action disabled={busy||!pending&&!value.trim()} onClick={()=>void submit()}>{busy?'正在核对…':pending?'核对原提交':'保存这一处纠错'}</Action>
    <Action secondary disabled={busy} onClick={()=>{clear();onReload();}}>{pending?'重新读取当前档案':'先不纠错'}</Action>
  </Panel>;
}
