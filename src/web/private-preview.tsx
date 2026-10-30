import {requestKey} from '../shared/client/request-key';
import React,{useEffect,useRef,useState} from 'react';
import type {PlusClient} from './client';

let active=0;const waiting:(()=>void)[]=[];
async function previewSlot<T>(signal:AbortSignal,work:()=>Promise<T>):Promise<T>{
  await new Promise<void>((resolve,reject)=>{
    const abort=()=>{const i=waiting.indexOf(start);if(i>=0)waiting.splice(i,1);reject(new DOMException('Aborted','AbortError'));};
    const start=()=>{signal.removeEventListener('abort',abort);if(signal.aborted){reject(new DOMException('Aborted','AbortError'));return;}active++;resolve();};
    if(signal.aborted){abort();return;}if(active<2)start();else{waiting.push(start);signal.addEventListener('abort',abort,{once:true});}
  });
  try{return await work();}finally{active--;waiting.shift()?.();}
}
/** Only visible thumbnails load, two at a time; private originals and object
 * URLs are discarded when this workspace closes. No credential enters a URL. */
export function PrivatePreview({api,deliverableId}:{api:PlusClient;deliverableId:string}){
  const host=useRef<HTMLDivElement>(null),[src,setSrc]=useState(''),[failed,setFailed]=useState(false);
  useEffect(()=>{
    const controller=new AbortController();let url='',started=false;
    const load=()=>{if(started)return;started=true;void previewSlot(controller.signal,async()=>{
      const link=await api.call('createDownloadLink',{params:{deliverable_id:deliverableId},key:requestKey()});
      if(controller.signal.aborted)return;const source=new URL(link.url);if(source.origin!==location.origin)throw new Error('Preview origin changed');
      const response=await fetch(source.href,{signal:controller.signal,credentials:'omit',cache:'no-store',redirect:'error',referrerPolicy:'no-referrer'});
      if(!response.ok||!response.headers.get('content-type')?.startsWith('image/png')||Number(response.headers.get('content-length')??0)>30*1024*1024)throw new Error('Preview unavailable');
      const blob=await response.blob();if(blob.size>30*1024*1024)throw new Error('Preview too large');
      const bitmap=await createImageBitmap(blob);
      try{
        if(controller.signal.aborted)return;const canvas=document.createElement('canvas');canvas.width=160;canvas.height=160;
        const context=canvas.getContext('2d');if(!context)throw new Error('Preview unavailable');context.fillStyle='#FFFAEE';context.fillRect(0,0,160,160);
        const scale=Math.min(160/bitmap.width,160/bitmap.height),w=bitmap.width*scale,h=bitmap.height*scale;context.drawImage(bitmap,(160-w)/2,(160-h)/2,w,h);
        const thumbnail=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('Preview unavailable')),'image/jpeg',.8));
        if(!controller.signal.aborted){url=URL.createObjectURL(thumbnail);setSrc(url);}
      }finally{bitmap.close();}
    }).catch(()=>{if(!controller.signal.aborted)setFailed(true);});};
    const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){observer.disconnect();load();}},{rootMargin:'120px'});
    if(host.current)observer.observe(host.current);return()=>{observer.disconnect();controller.abort();if(url)URL.revokeObjectURL(url);};
  },[api,deliverableId]);
  return <div className='plus-private-preview' ref={host}>{src?<img src={src} alt='这份草稿的原素材'/>:<span>{failed?'原素材暂不可预览':'原素材'}</span>}</div>;
}
