import sharp from 'sharp';
import {plusRenderFixture} from './plus-render';
import {mediaFixture} from './media';
import {insert} from '../../src/api/db/store';
import {id,hash,sha256,addSeconds} from '../../src/api/lib/crypto';
import type {DTO} from '../../src/shared/contracts/types';

/** Additional distinct products with actual private PNGs and explicitly
 * synthetic prior payment/QA metadata. Only the new batch executes workers. */
export async function plusBatchFixture(){
  const f=await plusRenderFixture();
  try{
    const parents=[{productId:f.product.product_id,orderId:f.originalId,artifactId:f.artifactId,pack:f.pack}];
    for(const [index,color] of ['#D37E53','#8DAD6E'].entries()){
      const g=await mediaFixture(f.db,{principal:f.buyer.principal}),p=f.buyer.principal,artifactId=id('artifact'),expires=addSeconds(86400);
      await f.db.pool.query("UPDATE stage_runs SET state='CANCELLED' WHERE scope_id=ANY($1::text[]) AND state NOT IN ('SUCCEEDED','FAILED')",[[g.orderId,g.plan.plan_id]]);
      const png=await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000"><rect width="800" height="1000" fill="#FFFAEE"/><rect x="200" y="230" width="400" height="540" rx="60" fill="${color}"/><text x="400" y="500" text-anchor="middle" font-family="sans-serif" font-size="34" fill="white">SYNTHETIC ${index+2}</text></svg>`)).png().toBuffer();
      const key=`${p.tenantId}/synthetic-batch-parent/${artifactId}.png`;await f.store.put(key,png,'image/png');
      const item:DTO<'Deliverable'>={deliverable_id:artifactId,slot_id:'hero',kind:'image',file_name:`synthetic-batch-parent-${index+2}.png`,mime_type:'image/png',size_bytes:png.length,width:800,height:1000,fps:null,duration_frames:null,text:null,sha256:sha256(png)};
      const pack:DTO<'Deliverables'>={order_id:g.orderId,manifest_id:id('manifest'),manifest_revision:1,expires_at:expires,items:[item]};
      await insert(f.db.pool,'artifacts',{id:artifactId,tenant_id:p.tenantId,order_id:g.orderId,stage_run_id:g.lease.id,slot_id:'hero',object_key:key,sha256:item.sha256,spec_json:{kind:'image',width:800,height:1000},data:{synthetic_batch_parent:true},expires_at:expires});
      await insert(f.db.pool,'delivery_manifests',{id:pack.manifest_id,tenant_id:p.tenantId,owner_id:p.userId,order_id:g.orderId,revision:1,hash:hash(pack),data:pack,private:{synthetic_batch_parent:true},expires_at:expires});
      await f.db.pool.query("UPDATE orders SET fulfillment_state='DELIVERED',data=data||jsonb_build_object('fulfillment_state','DELIVERED','delivery_expires_at',$2::text) WHERE id=$1",[g.orderId,expires]);
      parents.push({productId:g.product.product_id,orderId:g.orderId,artifactId,pack});
    }
    return {...f,parents};
  }catch(error){await f.close();throw error;}
}
