import {ApiClient,ClientError,type Transport,type CallOptions} from '../shared/client/api';
import type {DTO} from '../shared/contracts/types';
import type {endpoints} from '../shared/contracts/endpoints.generated';
type Operation=keyof typeof endpoints;
/** Browser credentials, pending link secrets and private results stay in memory. */
export class PlusClient{
  private generation=0;private session:DTO<'PlusBrowserSession'>|undefined;private requests=new Set<AbortController>();
  readonly api:ApiClient;
  constructor(origin:string,transport?:Transport){
    const wire:Transport=transport??(async input=>{
      const result=await fetch(input.url,{method:input.method,headers:input.headers,...(input.body===undefined?{}:{body:input.body as string}),
        ...(input.signal?{signal:input.signal}:{}),credentials:'omit',cache:'no-store',redirect:'error'});
      return{status:result.status,data:await result.text(),headers:Object.fromEntries(result.headers)};
    });
    this.api=new ApiClient(origin,wire,()=>this.disconnect(),true);
  }
  disconnect(){this.generation++;for(const controller of this.requests)controller.abort();this.requests.clear();this.session=undefined;this.api.setSession(null);}
  connected(){return this.session;}
  async call<K extends Operation>(operation:K,options:CallOptions<K>={}){
    const generation=this.generation,controller=new AbortController();this.requests.add(controller);const timeout=setTimeout(()=>controller.abort(),20000);
    try{
      const value=await this.api.call(operation,{...options,signal:controller.signal});
      if(generation!==this.generation)throw new ClientError('PLUS_CONNECTION_CHANGED','电脑连接已变化，请重新读取');
      return value;
    }catch(error){if(generation!==this.generation)throw new ClientError('PLUS_CONNECTION_CHANGED','电脑连接已关闭，请重新接续');throw error;}
    finally{clearTimeout(timeout);this.requests.delete(controller);}
  }
  async poll(link:DTO<'PlusLink'>){
    const generation=this.generation;
    const result=await this.call('pollPlusLink',{params:{link_id:link.link_id},body:{poll_key:link.poll_key}});
    if(generation!==this.generation)throw new ClientError('PLUS_CONNECTION_CHANGED','电脑连接已变化，请重新接续');
    if(result.state==='APPROVED'){
      const s=result.session;
      if(!s||!/^[A-Za-z0-9_-]{43}$/.test(s.access_token)||s.connection.state!=='ACTIVE'||!Number.isFinite(Date.parse(s.expires_at))||Date.parse(s.expires_at)<=Date.now())
        throw new ClientError('PLUS_RESPONSE_INVALID','未收到有效电脑连接，请重新接续');
      this.session=s;this.api.setSession(s);
    }
    return result;
  }
}
