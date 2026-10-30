import React,{useState} from 'react';
import {Text} from '@tarojs/components';
import {client} from './runtime';
import {readDraftAnalysis,resumeDraft} from '../client/drafts';
import {loadSelectedPreset,startSelectedPlan} from '../client/preset-selection';
import {Action,Notice,Panel,ResourceState,Slots,navigate,useAction,useResource} from './base';
import {ProductRecommendations} from './recommendations';
import {ProfileCorrection} from './profile-correction';
import {ClientError} from '../client/api';

export function Analysis(){
  const [correctionBlocked,setCorrectionBlocked]=useState(false);
  const action=useAction(),resource=useResource(async()=>{await client().login();const owner=client().api.userId,result=await readDraftAnalysis(client());
    if(owner!==client().api.userId)throw new ClientError('ACCOUNT_CHANGED','账户已变化，请重新读取当前草稿');return {...result,owner};},value=>Boolean(value.analysis&&['QUEUED','ANALYZING','VALIDATING'].includes(value.analysis.state)));
  const selection=useResource(async()=>{await client().login();return loadSelectedPreset(client());});
  const data=resource.data?.owner===client().api.userId?resource.data:undefined,profile=data?.profile;
  return <><Text className='page-headline'>{profile?'已经认识你的商品':'正在看看你的商品'}</Text><ResourceState {...resource} retry={resource.reload}/>
    {profile?<><Panel><Text className='card-title'>{profile.name??'你的商品'}</Text><Text>{profile.summary}</Text>
      {profile.observations.filter(o=>o.status==='OBSERVED').map((o,i)=><Text className='secondary' key={i}>{o.feature}：{o.value}</Text>)}
      <Text className='secondary'>暂不能确认：{profile.unknowns.join('、')||'未发现需要补充的属性'}</Text>
      {[...profile.observations,...profile.label_texts].filter(o=>o.status==='USER_CORRECTED').map((o,i)=><Text className='secondary' key={`correction-${i}`}>你的纠错（待复核）：{o.value}</Text>)}</Panel>
      <ProfileCorrection key={profile.profile_id} context={{product:data!.product,profile}} onBlocked={setCorrectionBlocked} onUpdated={resource.reload} onReload={resource.reload}/>
      {selection.data&&<Panel><Text className='card-title'>继续已选方案</Text><Text>{selection.data.detail.preset.name} · {selection.data.variant.name}</Text>
        <Text className='caption'>保留你所选的方案和规格版本</Text><Slots slots={selection.data.variant.output_slots}/>
        {(!selection.data.variant.sale_enabled||selection.data.variant.admission_state!=='ADMITTED'||selection.data.variant.price_fen===null)&&<Notice>所选规格暂未开放，可以查看原方案或重新选择。</Notice>}
        <Action disabled={action.busy||correctionBlocked||!selection.data.variant.sale_enabled||selection.data.variant.admission_state!=='ADMITTED'||selection.data.variant.price_fen===null} onClick={()=>void action.run(async()=>{
          const plan=await startSelectedPlan(client());navigate('confirm',{plan_id:plan.plan_id});
        })}>{action.busy?'正在整理素材清单…':'用已选方案继续制作'}</Action>
        <Action secondary onClick={()=>navigate('preset',{preset_id:selection.data!.detail.preset.preset_id,version:selection.data!.detail.preset.version,variant_id:selection.data!.variant.variant_id})}>查看原方案规格</Action></Panel>}
      {selection.error&&<Notice error>{selection.error}</Notice>}
      {!correctionBlocked&&<ProductRecommendations key={`${profile.product_id}:${profile.profile_id}:${profile.photo_version}`} profile={profile}/>}
      <Action secondary={Boolean(selection.data)} onClick={()=>navigate('catalog')}>{selection.data?'再看看其他方案':'挑选一套方案'}</Action>
      <Action secondary onClick={()=>navigate('photos')}>重新拍照</Action>
    </>:resource.data&&!data?<><Notice>当前账户已变化，请重新读取自己的商品草稿。</Notice><Action onClick={resource.reload}>重新读取当前草稿</Action></>
      :data&&data.analysis&&['FAILED','BLOCKED'].includes(data.analysis.state)?<><Notice error>这些照片暂时无法支持完整制作，请补拍整体和清晰细节。</Notice><Action onClick={()=>navigate('photos')}>重新拍照</Action></>
      :data&&!data.analysis?<><Notice>{data.product.photo_version?'照片已保存在草稿中，可以继续整理商品信息。':'这份草稿还没有完整的已上传照片，请重新选图。'}</Notice>
        <Action disabled={action.busy} onClick={()=>void action.run(async()=>{const next=await resumeDraft(client(),data.product.product_id);if(next.page==='analysis')resource.reload();else navigate(next.page,next.params);})}>
          {data.product.photo_version?'继续整理商品信息':'重新选择照片'}</Action></>
      :!resource.error&&<Notice>正在整理可见特点和照片用途。你可以离开页面，稍后从草稿继续。</Notice>}
    {action.error&&<Notice error>{action.error}</Notice>}
  </>;
}
