import React from 'react';
import {View,Text} from '@tarojs/components';
import {client} from './runtime';
import {resumeDraft} from '../client/drafts';
import {Action,Notice,Panel,More,ResourceState,navigate,useAction,useResource,usePagedResource} from './base';

export function ResumeDraft(){
  const action=useAction(),resource=useResource(async()=>{
    if(!client().hasPreviousAccount())return null;
    await client().login();return (await client().api.call('listProducts',{query:{limit:1}})).items[0]??null;
  });
  return <>{resource.data&&<Action secondary disabled={action.busy} onClick={()=>void action.run(async()=>{
    const next=await resumeDraft(client(),resource.data!.product_id);navigate(next.page,next.params);
  })}>{action.busy?'正在恢复原草稿…':'继续上次草稿'}</Action>}
    {(action.error||resource.error)&&<><Notice error>{action.error||resource.error}</Notice><Action secondary onClick={()=>navigate('library')}>查看我的草稿与订单</Action></>}
  </>;
}
export function ProductDrafts(){
  const action=useAction(),resource=usePagedResource(async cursor=>{
    await client().login();return client().api.call('listProducts',{query:{limit:5,cursor}});
  },p=>p.product_id);
  return <><View className='section-title'><Text>商品草稿</Text></View><ResourceState {...resource} retry={resource.reload}/>
    {resource.loaded&&!resource.items.length&&<Text className='secondary'>上传后的商品草稿会保存在这里。</Text>}
    {resource.items.map((draft,index)=><Panel key={draft.product_id}><Text className='card-title'>商品草稿 {index+1}</Text>
      <Text className='secondary'>{draft.profile_id?'商品信息已整理':draft.photo_version?'照片已上传，可继续识别':'照片尚未上传完整，可重新选图'}</Text>
      <Text className='caption'>{new Date(draft.created_at).toLocaleString()}</Text>
      <Action secondary disabled={action.busy} onClick={()=>void action.run(async()=>{
        const next=await resumeDraft(client(),draft.product_id);navigate(next.page,next.params);
      })}>{draft.profile_id?'继续选择或制作方案':draft.photo_version?'继续整理商品信息':'重新选择照片'}</Action></Panel>)}
    {action.error&&<Notice error>{action.error}</Notice>}<More {...resource}/>
  </>;
}
