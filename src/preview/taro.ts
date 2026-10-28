import {useEffect} from 'react';
export function useDidShow(callback:()=>void){useEffect(callback,[]);}
export function useDidHide(callback:()=>void){useEffect(()=>()=>callback(),[]);}
export function useRouter(){const query=location.hash.split('?')[1]??'';return {params:Object.fromEntries(new URLSearchParams(query))};}
const go=async({url}:{url:string})=>{location.hash=url;};
const Taro={navigateTo:go,reLaunch:go,redirectTo:go,navigateBack:async()=>{history.back();},getCurrentPages:()=>[{},{}],
  showToast:async({title}:{title:string})=>{window.dispatchEvent(new CustomEvent('preview:toast',{detail:title}));},
  showModal:async({title,content}:{title:string;content:string})=>({confirm:window.confirm(`${title}\n${content}\n浏览器演示，不调用真实服务。`),cancel:false})};
export default Taro;
