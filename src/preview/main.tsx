import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {MiniPage} from '../shared/ui/pages';
import {configureHost,client} from '../shared/ui/runtime';
import {type PageName} from '../shared/ui/base';
import {attachPreview,previewHost} from './fixtures';
import './preview.css';
configureHost(previewHost);attachPreview(client());
const scenes:[PageName,string][]=[['home','拍照制作'],['catalog','方案社区'],['photos','照片选择'],['analysis','商品档案'],['preset','方案详情'],['confirm','素材清单'],['order','订单回放'],['pack','领取素材'],['library','我的素材'],['creator','作者工作台']];
const route=(page:PageName)=>`/pages/${page}/index?preset_id=minimal-clean&version=3.1.0&plan_id=demo_plan&order_id=demo_order`;
function App(){
  const [hash,setHash]=useState(location.hash),[toast,setToast]=useState('');
  useEffect(()=>{const changed=()=>{setHash(location.hash);window.scrollTo(0,0);};const notify=(e:Event)=>{setToast((e as CustomEvent<string>).detail);setTimeout(()=>setToast(''),2500);};
    addEventListener('hashchange',changed);addEventListener('preview:toast',notify);return()=>{removeEventListener('hashchange',changed);removeEventListener('preview:toast',notify);};},[]);
  const requested=hash.match(/pages\/([^/]+)/)?.[1]??'home',page=(scenes.some(([p])=>p===requested)?requested:['favorites','draft','rights','publication','moderation','settings','help'].includes(requested)?requested:'home') as PageName;
  return <><aside className="preview-banner"><strong>一品成片 · 共享小程序页面</strong><span>浏览器回放 / Browser replay · 合成数据 / Synthetic fixtures</span><select aria-label="演示场景" value={page} onChange={e=>{location.hash=route(e.target.value as PageName);}}>{scenes.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></aside>
    <main className="preview-device"><MiniPage name={page} key={hash}/></main>{toast&&<div role="status" className="preview-toast">{toast}</div>}</>;
}
createRoot(document.getElementById('root')!).render(<App/>);
