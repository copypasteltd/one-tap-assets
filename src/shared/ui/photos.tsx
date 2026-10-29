import React,{useRef,useState} from 'react';
import {View,Text,Button,Image} from '@tarojs/components';
import type {LocalPhoto,PhotoPickerOptions} from '../platform/ports';
import {photoSelectionKey,selectPhotos} from '../client/photo-selection';
import {analyzePhotos} from '../client/photos';
import {client} from './runtime';
import {Action,Notice,navigate,useAction} from './base';

const newBatch=()=>`batch-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
export function Photos(){
  const [photos,setPhotos]=useState<LocalPhoto[]>([]),current=useRef(photos),batch=useRef(newBatch()),action=useAction();
  const update=(next:LocalPhoto[])=>{
    if(photoSelectionKey(next)!==photoSelectionKey(current.current))batch.current=newBatch();
    current.current=next;setPhotos(next);
  };
  const pick=(source:PhotoPickerOptions['source'],replace?:number)=>void action.run(async()=>{
    const count=replace!==undefined||source==='camera'?1:5-current.current.length;
    const picked=await client().host.choosePhotos({source,count});
    update(selectPhotos(current.current,picked,replace));
  });
  const remaining=Math.max(0,3-photos.length);
  return <><Text className='page-headline'>把商品拍清楚，<Text className='marked'>剩下的交给我们。</Text></Text>
    <Text className='secondary'>可以一张张拍，也可以从相册补充。无需填写商品表单。</Text>
    <View className='capture-guidance'>{['整体拍全','侧面换角度','细节看清楚'].map((text,i)=><View className='capture-guide' key={text}><Text className='capture-guide-number'>{i+1}</Text><Text>{text}</Text></View>)}</View>
    <View className='capture-progress'><Text className='card-title'>已添加 {photos.length} / 5 张</Text><Text className='caption'>{remaining?`再添加${remaining}张，即可开始识别`:photos.length===5?'照片已齐，可重拍或移除后补图':'已满足3张，可再补充不同角度'}</Text></View>
    <View className='selected-photos capture-grid'>{photos.map((photo,index)=><View className='capture-photo' key={`${index}:${photo.sha256}`}>
      <Image src={photo.path} mode='aspectFit' className='selected-photo' />
      <Text className='capture-photo-label'>照片 {index+1}</Text>
      <View className='capture-photo-actions'><Button className='capture-edit' disabled={action.busy} ariaLabel={`重拍第${index+1}张照片`} onClick={()=>pick('camera',index)}>重拍</Button>
        <Button className='capture-edit' disabled={action.busy} ariaLabel={`移除第${index+1}张照片`} onClick={()=>void action.run(async()=>update(current.current.filter((_,i)=>i!==index)))}>移除</Button></View>
    </View>)}</View>
    <View className='capture-actions'><Action disabled={action.busy||photos.length===5} onClick={()=>pick('camera')}>拍一张照片</Action>
      <Action secondary disabled={action.busy||photos.length===5} onClick={()=>pick('album')}>从相册补充</Action></View>
    {action.error&&<Notice error>{action.error}</Notice>}
    <Text className='caption'>请拍同一件商品，保持颜色和包装清晰。支持JPG / PNG，单张不超过10MB。</Text>
    <View className='capture-submit'><Action disabled={action.busy||photos.length<3} onClick={()=>void action.run(async()=>{
      await analyzePhotos(client(),[...current.current],batch.current);navigate('analysis');
    })}>{action.busy?'正在处理当前照片…':'开始识别商品'}</Action></View>
  </>;
}
