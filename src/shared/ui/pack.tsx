import React,{useEffect,useRef,useState} from 'react';
import Taro,{useDidHide,useRouter} from '@tarojs/taro';
import {View,Text,Button,Image,Video} from '@tarojs/components';
import type {DTO} from '../contracts/types';
import {AlbumQueue,type AlbumItem,type AlbumSelection} from '../client/album';
import {ClientError} from '../client/api';
import {client} from './runtime';
import {Action,Notice,Panel,ResourceState,navigate,useAction,useResource} from './base';
import {LimitedRevision} from './revision';

const states={PENDING:'等待保存',DOWNLOADING:'下载中',SAVING:'正在写入相册',SAVED:'已保存',FAILED:'保存未完成',UNKNOWN:'需要核对相册'};
const errors:Record<string,string>={ALBUM_PERMISSION_DENIED:'请在系统设置中允许相册权限后再重试。',PERMISSION_DENIED:'请在系统设置中允许相册权限后再重试。',
  ALBUM_STORAGE_FULL:'手机空间不足，请清理空间后再重试。',HOST_ALBUM_UNAVAILABLE:'当前应用版本不支持，请升级后继续领取。',
  ALBUM_CALLBACK_PENDING:'上一项相册回调仍待确认，请先核对相册。',SAVE_PAUSED:'已暂停，可继续保存。'};
export function Pack(){
  const route=useRouter();
  const resource=useResource(async()=>{
    await client().login();const buyer=client().api.userId,orderId=route.params.order_id??client().recover().orderId??'';
    const pack=await client().api.call('getDeliverables',{params:{order_id:orderId}});
    if(pack.order_id!==orderId||client().api.userId!==buyer)throw new ClientError('PACK_CHANGED','账户或素材包已变化，请重新查询原订单');
    return {pack,buyer};
  });
  return <><ResourceState {...resource} retry={resource.reload}/>{!resource.busy&&!resource.error&&resource.data&&resource.data.buyer===client().api.userId&&
    <PackContents key={`${resource.data.buyer}:${resource.data.pack.manifest_id}:${resource.data.pack.manifest_revision}`}
      pack={resource.data.pack} buyer={resource.data.buyer!} reload={resource.reload}/>}</>;
}
function PackContents({pack,buyer,reload}:{pack:DTO<'Deliverables'>;buyer:string;reload:()=>void}){
  const action=useAction(),queue=useRef<AlbumQueue>();const active=useRef(true);
  const [items,setItems]=useState<AlbumItem[]>([]),[queueError,setQueueError]=useState(''),[paused,setPaused]=useState(false);
  const [links,setLinks]=useState<Record<string,DTO<'DownloadLink'>>>({});
  const scope=()=>{if(!active.current||client().api.userId!==buyer)throw new ClientError('SAVE_ACCOUNT_CHANGED','账户已变化，请回到自己的素材包继续');};
  const openQueue=()=>{
    scope();if(!queue.current)queue.current=new AlbumQueue(client(),pack,value=>{if(active.current&&client().api.userId===buyer)setItems(value);});
    return queue.current;
  };
  useEffect(()=>{
    active.current=true;
    try{openQueue().restore();}catch(e){setQueueError(e instanceof ClientError?e.message:'保存记录暂时无法读取，请重新查询原素材包');}
    return ()=>{active.current=false;queue.current?.stop();};
  },[]);
  useDidHide(()=>queue.current?.stop());
  const save=(selection:AlbumSelection={})=>void action.run(async()=>{scope();setPaused(false);await openQueue().run(selection);});
  const media=pack.items.filter(i=>i.kind!=='copy'),saved=items.filter(i=>i.state==='SAVED').length,unknown=items.filter(i=>i.state==='UNKNOWN').length;
  const failed=items.filter(i=>i.state==='FAILED').length;
  return <><View className='pack-heading'><Text className='page-headline'>你的整套素材，做好了。</Text><Text>领取至 {new Date(pack.expires_at).toLocaleString()}</Text></View>
    {!!media.length&&<Panel><Text className='card-title'>保存到手机相册</Text>
      <Text className='secondary'>已确认保存 {saved} / {media.length} 项 · 待核对 {unknown} 项 · 未完成 {failed} 项</Text>
      <Text className='caption'>图片和视频逐项保存，文案单独复制。已明确成功的文件会跳过。</Text>
      <Action disabled={action.busy||!!queueError} onClick={()=>save()}>{action.busy?'正在逐项保存…':'保存素材到相册'}</Action>
      <View className='filters'>{media.some(i=>i.kind==='image')&&<Button className='filter' disabled={action.busy||!!queueError} onClick={()=>save({kind:'image'})}>只存图片</Button>}
        {media.some(i=>i.kind==='video')&&<Button className='filter' disabled={action.busy||!!queueError} onClick={()=>save({kind:'video'})}>只存视频</Button>}
        {action.busy&&<Button className='filter' onClick={()=>{queue.current?.stop();setPaused(true);}}>暂停后续保存</Button>}</View>
      {paused&&<Notice>已暂停后续保存；已交给手机的这一项仍等待回调，请先核对相册。</Notice>}
      {queueError&&<Notice error>{queueError}</Notice>}
      {items.map(item=>{const original=pack.items.find(i=>i.deliverable_id===item.id)!;const number=media.filter(i=>i.kind===item.kind).findIndex(i=>i.deliverable_id===item.id)+1;
        return <View className='save-row album-save-row' key={item.id}><View className='album-save-info'><Text>{item.kind==='image'?'图片':'短片'} {number} · {states[item.state]}</Text>
          {item.error&&errors[item.error]&&<Text className='secondary'>{errors[item.error]}</Text>}</View>
          {item.state==='FAILED'&&<Button className='filter' disabled={action.busy} onClick={()=>save({deliverableIds:[item.id]})}>重试这项</Button>}
          {item.state==='UNKNOWN'&&<Button className='filter' disabled={action.busy} onClick={()=>void action.run(async()=>{
            const answer=await Taro.showModal({title:'先查看手机相册',content:`请核对${original.kind==='image'?'图片':'短片'} ${number}。已经保存时请不要重试；仅在确认相册中没有它时继续，以免重复。`,confirmText:'确认未保存',cancelText:'暂不重试'});
            scope();if(answer.confirm){setPaused(false);await openQueue().run({deliverableIds:[item.id],confirmedMissingIds:[item.id]});}
          })}>已核对，重试</Button>}</View>;
      })}<Text className='caption'>下载完成不代表已写入相册。保存失败可在领取期内继续，不重新制作或收费。</Text>
    </Panel>}
    {action.error&&<Notice error>{action.error}</Notice>}
    {pack.items.map(item=><Panel key={item.deliverable_id}><View className='section-title'><Text>{item.kind==='image'?'商品图片':item.kind==='video'?'商品短片':'商品文案'}{pack.cover_deliverable_id===item.deliverable_id?' · 素材包封面':''}</Text><Text className='caption'>{item.width?`${item.width} × ${item.height}`:''}</Text></View>
      {item.kind==='copy'?<><Text selectable>{item.text}</Text><Action secondary disabled={action.busy} onClick={()=>void action.run(async()=>{scope();await client().host.copy(item.text??'');scope();await Taro.showToast({title:'文案已复制',icon:'none'});})}>复制文案</Action></>:
        <>{links[item.deliverable_id]?item.kind==='image'?<Image src={links[item.deliverable_id]!.url} mode='widthFix' className='pack-image'/>:<Video src={links[item.deliverable_id]!.url} controls objectFit='contain' className='pack-video'/>:
          <View className='media-placeholder'><Text>{item.kind==='image'?'点击查看这张图片':'点击查看完整竖屏短片'}</Text></View>}
          <Action secondary disabled={action.busy} onClick={()=>void action.run(async()=>{
            scope();const link=await client().api.call('createDownloadLink',{params:{deliverable_id:item.deliverable_id},key:client().intent('view-link',{id:item.deliverable_id,nonce:Date.now()})});scope();
            if(link.deliverable_id!==item.deliverable_id||!(Date.parse(link.expires_at)>Date.now()))throw new ClientError('SAVE_LINK_INVALID','领取链接已变化或过期，请重新查询');
            setLinks(old=>({...old,[item.deliverable_id]:link}));
          })}>{links[item.deliverable_id]?'重新获取查看链接':'查看素材'}</Action></>}
    </Panel>)}
    <LimitedRevision key={pack.manifest_id} pack={pack} onDelivered={reload}/>
    <Action secondary onClick={()=>navigate('help',{order_id:pack.order_id})}>素材问题反馈</Action>
  </>;
}
