import type pg from 'pg';
import sharp from 'sharp';
import type { Config } from '../../api/config.js';
import { transaction } from '../../api/db/pool.js';
import type { ObjectStorage } from '../../api/storage/storage.js';
import { writePrivateObject } from '../../api/storage/private-objects.js';
import { hash,sha256 } from '../../api/lib/crypto.js';
import { requireThat } from '../../api/lib/errors.js';
import { previewContext,checkPreviewBytes,PREVIEW_RENDERER_VERSION,type PreviewOutput } from '../../api/modules/previews.js';
import { assertLease,PendingExternal,type StageLease } from '../queue/leases.js';
import type { StageCommit } from '../runtime.js';
import { loadProductionFont } from '../media/font.js';
import { renderLayout,xml } from '../media/layout.js';
import { inspectImage } from '../media/photo-pipeline.js';

/** Deterministic preview of the first contracted image. It consumes no paid
 * generation, has its own private lifetime, and never writes order artifacts. */
export class OptionalPreviewService {
  constructor(private pool:pg.Pool,private cfg:Config,private store:ObjectStorage){}
  private async context(lease:StageLease) {
    return transaction(this.pool,async db=>{
      const ctx=await previewContext(db,lease.tenant_id,lease.scope_id,undefined,true); await assertLease(db,lease);
      requireThat(['QUEUED','GENERATING'].includes(ctx.row.state) && ctx.row.private.input_hash===lease.input_hash,
        'PREVIEW_INPUT_CHANGED','本人预览输入或状态已经变化',409);
      requireThat(ctx.plan.data.engine==='PHOTO_LAYOUT','PREVIEW_ENGINE_NOT_AVAILABLE','该生成式方案尚未接入本人预览',503);
      await db.query(`UPDATE optional_previews SET state='GENERATING',updated_at=now(),data=data||'{"state":"GENERATING"}'::jsonb WHERE tenant_id=$1 AND id=$2`,[lease.tenant_id,lease.scope_id]);
      return ctx;
    });
  }
  private alive(lease:StageLease,signal:AbortSignal):void {
    requireThat(!signal.aborted,'PREVIEW_INTERRUPTED','本人预览已停止',409);
    requireThat(lease.deadline_at.getTime()>Date.now(),'PREVIEW_DEADLINE_EXCEEDED','本人预览制作期限已结束',409);
  }
  private async render(lease:StageLease,signal:AbortSignal):Promise<{bytes:Buffer;output:PreviewOutput}> {
    const ctx=await this.context(lease); this.alive(lease,signal);
    const rows=(await this.pool.query<{id:string;sha256:string;object_key:string}>(`SELECT a.id,a.sha256,a.object_key FROM product_photo_items i
      JOIN assets a ON a.tenant_id=i.tenant_id AND a.id=i.asset_id WHERE i.tenant_id=$1 AND i.photo_version_id=$2
      AND a.owner_id=$3 AND a.product_id=$4 AND a.state='READY' AND a.expires_at>clock_timestamp() ORDER BY i.position`,
      [lease.tenant_id,ctx.input.photo_version_id,ctx.row.owner_id,ctx.row.product_id])).rows;
    requireThat(rows.length>=3 && rows.length<=5 && hash({photos:rows.map(r=>({asset_id:r.id,sha256:r.sha256})),revision:ctx.input.photo_version,
      normalization:'sharp-auto-orient-strip-png-v1'})===ctx.input.photo_set_hash,'PHOTO_SET_CHANGED','预览照片集合与原方案不一致',409);
    const slot=ctx.plan.private.creative.image_slots[0];
    const spec=ctx.plan.data.output_slots.find(s=>s.kind==='image' && s.slot_id===slot?.slot_id);
    const photo=rows.find(r=>r.id===slot?.asset_id);
    requireThat(photo && spec?.width && spec.height,'PREVIEW_PHOTO_MISSING','原方案缺少可预览图片',422);
    const original=await this.store.get(photo.object_key,30_000_000);
    requireThat(sha256(original)===photo.sha256,'PHOTO_HASH_MISMATCH','实际照片与原方案不一致',503);
    const font=await loadProductionFont(this.cfg.projectRoot);
    const rendered=await renderLayout(original,{presetId:ctx.input.style_id,width:spec.width,height:spec.height,title:slot!.title,
      subtitle:ctx.plan.private.creative.copy,sequence:1,total:ctx.plan.private.creative.image_slots.length,font});
    this.alive(lease,signal);
    const scaled=await sharp(rendered).resize({width:720,withoutEnlargement:true}).png().toBuffer({resolveWithObject:true});
    const width=scaled.info.width; const banner=96; const height=scaled.info.height+banner;
    const message='本人预览 · 非最终素材包\n首张图片示意，完整清单以订单为准';
    const watermark=await sharp({text:{text:`<span foreground="#FFFFFF" fallback="false">${xml(message)}</span>`,
      font:'Noto Sans SC 24',fontfile:font.path,rgba:true,dpi:72}}).png().toBuffer({resolveWithObject:true});
    requireThat(watermark.info.width<=width-32 && watermark.info.height<=banner-16,'PREVIEW_WATERMARK_OVERFLOW','预览说明无法完整显示',503);
    const bytes=await sharp({create:{width,height,channels:4,background:'#263B32'}}).composite([
      {input:scaled.data,left:0,top:0},{input:watermark.data,left:16,top:scaled.info.height+12}]).png().toBuffer();
    const actual=await inspectImage(bytes);
    requireThat(actual.width===width && actual.height===height && bytes.length<=12_000_000,'PREVIEW_FILE_INVALID','预览文件规格异常',503);
    return {bytes,output:{object_key:`${lease.tenant_id}/previews/${lease.scope_id}/preview.png`,sha256:sha256(bytes),size_bytes:bytes.length,
      width,height,input_hash:lease.input_hash,renderer_version:PREVIEW_RENDERER_VERSION,source_asset_id:photo.id,slot_id:slot!.slot_id}};
  }
  private async stored(lease:StageLease,output:PreviewOutput):Promise<Buffer|null> {
    requireThat(output.object_key===`${lease.tenant_id}/previews/${lease.scope_id}/preview.png` && output.input_hash===lease.input_hash
      && output.renderer_version===PREVIEW_RENDERER_VERSION,'PREVIEW_CHECKPOINT_CHANGED','原预览检查点归属不一致',503);
    const row=(await this.pool.query<{state:string;sha256:string;delete_requested:boolean;owner_id:string;product_id:string;expires_at:Date}>(
      'SELECT * FROM private_object_writes WHERE tenant_id=$1 AND preview_id=$2 AND object_key=$3',[lease.tenant_id,lease.scope_id,output.object_key])).rows[0];
    if(!row) return null;
    if(['WRITING','UNKNOWN'].includes(row.state)) throw new PendingExternal(2,'PREVIEW_ORIGINAL_WRITE_PENDING');
    const {row:preview}=await this.context(lease);
    requireThat(row.state==='STORED' && !row.delete_requested && row.expires_at.getTime()>Date.now() && row.sha256===output.sha256
      && row.owner_id===preview.owner_id && row.product_id===preview.product_id,'PREVIEW_FILE_UNAVAILABLE','原预览文件已经撤回或改变',410);
    const bytes=await this.store.get(output.object_key,12_000_000); checkPreviewBytes(output,bytes);
    const actual=await inspectImage(bytes);
    requireThat(actual.width===output.width && actual.height===output.height,'PREVIEW_FILE_CHANGED','原预览文件规格不一致',503); return bytes;
  }
  async handle(lease:StageLease,signal:AbortSignal):Promise<StageCommit> {
    requireThat(lease.scope_type==='PREVIEW' && lease.stage_name==='PREVIEW','PREVIEW_SCOPE_INVALID','预览执行作用域无效',500);
    let ctx=await this.context(lease); this.alive(lease,signal); let output=ctx.row.private.output;
    if(!output || !await this.stored(lease,output)) {
      const rendered=await this.render(lease,signal);
      if(output) requireThat(hash(output)===hash(rendered.output),'PREVIEW_CHECKPOINT_CHANGED','原预览写入意图与重新计算不一致',503);
      output=rendered.output;
      await transaction(this.pool,async db=>{
        const current=await previewContext(db,lease.tenant_id,lease.scope_id,ctx.row.owner_id,true); await assertLease(db,lease);
        requireThat(!current.row.private.output || hash(current.row.private.output)===hash(output),'PREVIEW_CHECKPOINT_CHANGED','预览检查点已变化',409);
        await db.query(`UPDATE optional_previews SET private=private||jsonb_build_object('output',$3::jsonb),updated_at=now() WHERE tenant_id=$1 AND id=$2`,
          [lease.tenant_id,lease.scope_id,JSON.stringify(output)]);
      });
      this.alive(lease,signal);
      await writePrivateObject(this.pool,this.store,{tenantId:lease.tenant_id,ownerId:ctx.row.owner_id,productId:ctx.row.product_id,
        previewId:lease.scope_id,kind:'MEDIA',expiresAt:ctx.input.expires_at},output.object_key,rendered.bytes,'image/png');
    }
    const finished=output; this.alive(lease,signal); await this.stored(lease,finished);
    return async db=>{
      ctx=await previewContext(db,lease.tenant_id,lease.scope_id,ctx.row.owner_id,true);
      requireThat(ctx.row.private.input_hash===lease.input_hash && hash(ctx.row.private.output)===hash(finished),'PREVIEW_CHECKPOINT_CHANGED','预览提交检查点不一致',409);
      const object=await db.query(`SELECT id FROM private_object_writes WHERE tenant_id=$1 AND preview_id=$2 AND object_key=$3 AND sha256=$4
        AND state='STORED' AND NOT delete_requested AND expires_at>clock_timestamp() FOR SHARE`,[lease.tenant_id,lease.scope_id,finished.object_key,finished.sha256]);
      requireThat(object.rowCount===1,'PREVIEW_FILE_UNAVAILABLE','预览文件已撤回或尚未核对',410);
      const bytes=await this.store.get(finished.object_key,12_000_000); checkPreviewBytes(finished,bytes);
      this.alive(lease,signal);
      await db.query(`UPDATE optional_previews SET state='READY',object_key=$3,data=data||'{"state":"READY"}'::jsonb,updated_at=now()
        WHERE tenant_id=$1 AND id=$2 AND state='GENERATING'`,[lease.tenant_id,lease.scope_id,finished.object_key]);
    };
  }
}
