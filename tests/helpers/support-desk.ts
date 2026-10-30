import sharp from 'sharp';
import {testDatabase,account,orderFixture} from './database';
import {buildApp} from '../../src/api/app';
import {sha256,id} from '../../src/api/lib/crypto';
import {insert} from '../../src/api/db/store';
import {storage} from '../../src/api/storage/storage';
import type {DTO} from '../../src/shared/contracts/types';
export async function supportDeskEnvironment(){
  const db=await testDatabase(),roles={alpha:'synthetic-support-alpha',beta:'synthetic-support-beta',read:'synthetic-support-read',write:'synthetic-support-write'};
  db.cfg.managementTokens=JSON.stringify(Object.entries(roles).map(([actor,value])=>({actor:`fixture-${actor}`,token_hash:sha256(value),
    permissions:actor==='read'?['support:read']:actor==='write'?['support:write']:['support:read','support:write','support:evidence']})));
  const store=storage(db.cfg),app=await buildApp({cfg:db.cfg,pool:db.pool,storage:store,tls:false});
  const admin=(credential=roles.alpha)=>({authorization:`Bearer ${credential}`});
  async function fixture(proof=false){
    const user=await account(db),order=await orderFixture(db,100000,user.principal),headers={authorization:`Bearer ${user.accessToken}`};
    // A confirmed synthetic order needs its original payment record for privacy cancellation/refund intents.
    await insert(db.pool,'payments',{id:id('payment'),tenant_id:user.principal.tenantId,order_id:order.orderId,provider:'alipay',merchant_id:'synthetic-support-merchant',
      state:'CONFIRMED',amount_fen:100,intent_key:`payment:${order.orderId}`,data:{fixture:'SYNTHETIC_SUPPORT_PAYMENT_NO_PROVIDER_CALLED'}});
    const ids:string[]=[];let image:Buffer|undefined;
    if(proof){
      image=await sharp({create:{width:1024,height:1024,channels:3,background:'#E6EDD3'}}).png().toBuffer();
      const grant=await app.inject({method:'POST',url:'/v1/p01/assets',headers:{...headers,'idempotency-key':`proof:${order.orderId}`},
        payload:{purpose:'SUPPORT_EVIDENCE',file_name:'synthetic-support-evidence.png',mime_type:'image/png',size_bytes:image.length,sha256:sha256(image)}});
      if(grant.statusCode!==201)throw new Error(`Synthetic proof grant failed: ${grant.statusCode} ${grant.body}`);
      const upload=grant.json().data as DTO<'UploadGrant'>;
      const put=await app.inject({method:'PUT',url:new URL(upload.upload_url).pathname,headers:{...upload.headers,'content-type':'application/octet-stream'},payload:image});
      if(put.statusCode!==204)throw new Error(`Synthetic proof upload failed: ${put.statusCode}`);
      const completed=await app.inject({method:'POST',url:`/v1/p01/assets/${upload.asset_id}/complete`,headers:{...headers,'idempotency-key':`complete:${order.orderId}`},payload:{sha256:sha256(image)}});
      if(completed.statusCode!==200)throw new Error(`Synthetic proof completion failed: ${completed.statusCode} ${completed.body}`);ids.push(upload.asset_id);
    }
    const request=await app.inject({method:'POST',url:`/v1/p01/orders/${order.orderId}/tickets`,headers:{...headers,'idempotency-key':`ticket:${order.orderId}`},
      payload:{category:'SAVE',message:'合成反馈：保存图片后仍想了解原订单处理进展。',attachment_asset_ids:ids}});
    if(request.statusCode!==201)throw new Error(`Synthetic ticket failed: ${request.statusCode} ${request.body}`);
    return {...user,...order,headers,ticket:request.json().data as DTO<'Ticket'>,ids,image};
  }
  return {db,app,roles,store,admin,fixture,close:async()=>{await app.close();await db.close();}};
}
