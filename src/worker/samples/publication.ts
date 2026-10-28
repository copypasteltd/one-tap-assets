import type pg from 'pg';
import type { Config } from '../../api/config.js';
import type { DTO } from '../../shared/contracts/types.js';
import { transaction, type Db } from '../../api/db/pool.js';
import { owned } from '../../api/db/store.js';
import { hash, sha256 } from '../../api/lib/crypto.js';
import { AppError, requireThat } from '../../api/lib/errors.js';
import { lockMediaOwner } from '../../api/modules/media-access.js';
import { authorizedSample, verifyAuthorizedFiles, type AuthorizedRow } from '../../api/modules/authorized-samples.js';
import { compilePresetConfig } from '../../api/modules/community.js';
import { verifySampleFiles, type SampleObject } from '../../api/modules/sample-evidence.js';
import { verifyCompletedSample } from './completion.js';
import { writePrivateObject } from '../../api/storage/private-objects.js';
import type { ObjectStorage } from '../../api/storage/storage.js';
import { assertLease, PendingExternal, type StageLease } from '../queue/leases.js';
import type { StageCommit } from '../runtime.js';

/** Approval schedules a durable copy, never storage writes inside its transaction.
 * A recovered key is observed by hash; WRITING/UNKNOWN is never PUT again. */
export class PublicSamplePreparationService {
  constructor(private pool: pg.Pool, private cfg: Config, private store: ObjectStorage) {}
  private async context(db: Db, lease: StageLease): Promise<{ publication: Awaited<ReturnType<typeof owned<DTO<'Publication'>>>>; copies: AuthorizedRow[] }> {
    requireThat(lease.scope_type === 'PUBLICATION' && lease.stage_name === 'PUBLIC_SAMPLE_PREPARE', 'PUBLIC_SAMPLE_STAGE_INVALID','公开样例阶段不匹配',409);
    const hint = (await db.query<{ owner_id: string }>('SELECT owner_id FROM publications WHERE tenant_id=$1 AND id=$2',[lease.tenant_id,lease.scope_id])).rows[0];
    requireThat(hint,'PUBLICATION_NOT_FOUND','发布记录不存在',404); await lockMediaOwner(db,lease.tenant_id,hint.owner_id);
    await assertLease(db,lease);
    const publication = await owned<DTO<'Publication'>>(db,'publications',lease.scope_id,{tenantId:lease.tenant_id,userId:hint.owner_id},true);
    const ids = publication.data.public_sample_ids;
    const binding = publication.private!.public_sample_preparation as { stage_id: string; input_hash: string } | undefined;
    requireThat(ids?.length && new Set(ids).size===ids.length && binding?.stage_id===lease.id && binding.input_hash===lease.input_hash
      && hash({publication_id:publication.id,public_sample_ids:ids})===lease.input_hash
      && hash(lease.private.public_sample_ids)===hash(ids),'PUBLIC_SAMPLE_BINDING_CHANGED','公开副本阶段输入已变化',409);
    const copies = [];
    for (const sampleId of [...ids].sort()) {
      const row = await authorizedSample(db,sampleId,['PREPARING'],true);
      requireThat(row.publication_id===publication.id,'PUBLIC_SAMPLE_BINDING_CHANGED','公开副本不属于当前发布',409); copies.push(row);
    }
    return { publication,copies };
  }
  async handle(lease: StageLease, signal: AbortSignal): Promise<StageCommit> {
    const {publication,copies} = await transaction(this.pool,db=>this.context(db,lease));
    const owner = {tenantId:publication.tenant_id,userId:publication.owner_id!}; const results = new Map<string,SampleObject[]>();
    for (const copy of copies) {
      const media: SampleObject[] = []; let sourceVerified = false;
      for (const source of copy.private.input.source_media) {
        signal.throwIfAborted();
        requireThat(/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(source.item_id),'SAMPLE_MEDIA_INVALID','样例文件标识无效',422);
        const item: SampleObject = {...source,object_key:`${copy.tenant_id}/authorized-samples/${copy.id}/${source.item_id}.${source.kind==='video'?'mp4':'png'}`};
        const previous = (await this.pool.query<{ state: string; sha256: string; delete_requested: boolean; authorized_sample_id: string; owner_id: string }>('SELECT state,sha256,delete_requested,authorized_sample_id,owner_id FROM private_object_writes WHERE object_key=$1',[item.object_key])).rows[0];
        if (previous) {
          requireThat(previous.authorized_sample_id===copy.id && previous.owner_id===copy.owner_id && previous.sha256===source.sha256
            && !previous.delete_requested,'PUBLIC_SAMPLE_FILE_CHANGED','原公开副本归属或摘要不一致',409);
          if (['WRITING','UNKNOWN'].includes(previous.state)) throw new PendingExternal(5,'PUBLIC_SAMPLE_COPY_PENDING');
          requireThat(previous.state==='STORED','PUBLIC_SAMPLE_FILE_UNAVAILABLE','原公开副本已撤回',410);
          const bytes = await this.store.get(item.object_key,item.size_bytes);
          requireThat(bytes.length===item.size_bytes && sha256(bytes)===item.sha256,'PUBLIC_SAMPLE_FILE_CHANGED','原公开副本文件已变化',503);
        } else {
          if (!sourceVerified) {
            await transaction(this.pool,async db=>{
              await this.context(db,lease); await owned(db,'product_drafts',copy.source_product_id,owner);
              const original = await owned<DTO<'Sample'>>(db,'public_samples',copy.source_sample_id,owner,true);
              requireThat(original.data.state==='READY' && !original.private?.media_revoked && original.product_id===copy.source_product_id
                && hash(original.private?.media)===hash(copy.private.input.source_media)
                && hash(original.private?.completion??{explicit_test_fixture:original.private?.test_fixture===true})===copy.private.input.source_completion_hash,
              'SAMPLE_NOT_READY','公开副本的原始审核样例不再有效',422);
              const compiled = await compilePresetConfig(db,publication.private!.config as DTO<'PresetConfig'>);
              requireThat(hash(compiled)===copy.private.input.compiled_hash,'PUBLICATION_SOURCE_CHANGED','审核后制作映射已变化',422);
              await verifyCompletedSample(db,this.cfg,copy.tenant_id,copy.source_sample_id,original.private!);
              await verifySampleFiles(db,this.cfg,owner,copy.source_sample_id,copy.private.input.source_media);
            }); sourceVerified = true;
          }
          const bytes = await this.store.get(source.object_key,source.size_bytes);
          requireThat(bytes.length===source.size_bytes && sha256(bytes)===source.sha256,'SAMPLE_MEDIA_CHANGED','原样例实际文件已变化',422);
          await transaction(this.pool,db=>this.context(db,lease)); signal.throwIfAborted();
          try { await writePrivateObject(this.pool,this.store,{tenantId:copy.tenant_id,ownerId:copy.owner_id!,authorizedSampleId:copy.id,kind:'MEDIA'},item.object_key,bytes,source.kind==='video'?'video/mp4':'image/png'); }
          catch (error) { if (error instanceof AppError && error.code==='PRIVATE_OBJECT_WRITE_PENDING') throw new PendingExternal(5,'PUBLIC_SAMPLE_COPY_PENDING'); throw error; }
        }
        media.push(item);
      }
      results.set(copy.id,media);
    }
    signal.throwIfAborted();
    return async db=>{
      const current = await this.context(db,lease);
      for (const copy of current.copies) {
        const media = results.get(copy.id)!; const privateData = {...copy.private,media,media_hash:hash(media)};
        await verifyAuthorizedFiles(db,this.cfg,{...copy,private:privateData});
        await db.query("UPDATE authorized_samples SET state='READY',private=$3,updated_at=now() WHERE tenant_id=$1 AND id=$2 AND state='PREPARING'",[copy.tenant_id,copy.id,JSON.stringify(privateData)]);
      }
      const data: DTO<'Publication'> = {...current.publication.data,revision:current.publication.data.revision+1,public_sample_state:'READY'};
      await db.query('UPDATE publications SET data=$3,revision=$4,updated_at=now() WHERE tenant_id=$1 AND id=$2',[publication.tenant_id,publication.id,data,data.revision]);
    };
  }
}
