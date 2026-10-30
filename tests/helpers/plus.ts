import sharp from 'sharp';
import {testDatabase,account,orderFixture} from './database';
import {buildApp} from '../../src/api/app';
import {insert} from '../../src/api/db/store';
import {id,hash,sha256,addSeconds,iso} from '../../src/api/lib/crypto';
import type {DTO} from '../../src/shared/contracts/types';
import type {ObjectStorage} from '../../src/api/storage/storage';
import type {Config} from '../../src/api/config';

/** Native HTTP/PG and actual PNG bytes, with explicitly synthetic paid/QA metadata.
 * This does not execute Codex, the payment provider or a production object store. */
export async function plusFixture(overrides:Partial<Config>={}){
  const db=await testDatabase();
  try{
    const buyer=await account(db),other=await account(db),f=await orderFixture(db,10000,buyer.principal),p=buyer.principal;
    const scope=(await db.pool.query('SELECT product_id FROM privacy_order_scope WHERE tenant_id=$1 AND id=$2',[p.tenantId,f.orderId])).rows[0];
    const productId=String(scope.product_id),stageId=id('stage'),artifactId=id('artifact'),manifestId=id('manifest'),expires=addSeconds(86400);
    const png=await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640"><rect width="640" height="640" fill="#CFE9D6"/><circle cx="320" cy="320" r="235" fill="#FFFAEE"/><rect x="245" y="180" width="150" height="320" rx="35" fill="#FF7948"/><rect x="273" y="130" width="94" height="70" rx="12" fill="#263B32"/><rect x="268" y="295" width="104" height="110" rx="6" fill="#FFFAEE"/><text x="320" y="342" text-anchor="middle" font-family="sans-serif" font-size="22" fill="#263B32">DEMO</text><text x="320" y="376" text-anchor="middle" font-family="sans-serif" font-size="14" fill="#263B32">SYNTHETIC</text></svg>')).png().toBuffer();
    const objects=new Map<string,Buffer>(),key=`synthetic-plus/${artifactId}.png`;objects.set(key,png);
    const store:ObjectStorage={put:async(k,b)=>{objects.set(k,b);},get:async k=>{const b=objects.get(k);if(!b)throw new Error('Synthetic object missing');return b;},delete:async k=>{objects.delete(k);},exists:async k=>objects.has(k)};
    const item:DTO<'Deliverable'>={deliverable_id:artifactId,slot_id:'hero',kind:'image',file_name:'synthetic-product.png',mime_type:'image/png',size_bytes:png.length,width:640,height:640,fps:null,duration_frames:null,text:null,sha256:sha256(png)};
    const pack:DTO<'Deliverables'>={order_id:f.orderId,manifest_id:manifestId,manifest_revision:1,expires_at:expires,items:[item]};
    await insert(db.pool,'stage_runs',{id:stageId,tenant_id:p.tenantId,scope_type:'ORDER',scope_id:f.orderId,stage_name:'PRODUCTION',input_hash:'a'.repeat(64),state:'READY',deadline_at:addSeconds(60),data:{synthetic_plus_fixture:true}});
    await insert(db.pool,'artifacts',{id:artifactId,tenant_id:p.tenantId,order_id:f.orderId,stage_run_id:stageId,slot_id:'hero',object_key:key,sha256:item.sha256,spec_json:{kind:'image',width:640,height:640},data:{synthetic_plus_fixture:true},expires_at:expires});
    await insert(db.pool,'delivery_manifests',{id:manifestId,tenant_id:p.tenantId,owner_id:p.userId,order_id:f.orderId,revision:1,hash:hash(pack),data:pack,private:{synthetic_plus_fixture:true},expires_at:expires});
    await db.pool.query(`UPDATE orders SET fulfillment_state='DELIVERED',data=data||jsonb_build_object('fulfillment_state','DELIVERED','delivery_expires_at',$1::text,'created_at',$2::text,'quote_id',quote_id,'refund_id',NULL,'job_id',NULL) WHERE id=$3`,[expires,iso(),f.orderId]);
    const cfg={...db.cfg,publicBaseUrl:'https://plus-fixture.invalid',...overrides};
    const app=await buildApp({cfg,pool:db.pool,storage:store,tls:!!(cfg.tlsCert&&cfg.tlsKey)&&!!overrides.publicBaseUrl?.startsWith('https://127.0.0.1')});
    return{db,cfg,app,buyer,other,orderId:f.orderId,productId,artifactId,manifestId,pack,item,png,objects,close:async()=>{await app.close();await db.close();}};
  }catch(error){await db.close();throw error;}
}
