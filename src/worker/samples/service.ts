import {sampleGenerationGateway,prepareSampleReferences} from './generation.js';
import type {GenerationGateway} from '../generation/gateway.js';
import type pg from 'pg';
import { transaction } from '../../api/db/pool.js';
import type { Config } from '../../api/config.js';
import type { ObjectStorage } from '../../api/storage/storage.js';
import { hash } from '../../api/lib/crypto.js';
import { requireThat } from '../../api/lib/errors.js';
import { creativePlanSchema, basePlan, validateCreativePlan, type CreativePlan } from '../compiler/plan.js';
import { assertLease, PendingExternal, type StageLease } from '../queue/leases.js';
import type { StageCommit } from '../runtime.js';
import { CodexRuntimeAdapter, type RoleRequest, type RoleResult } from '../codex/runtime.js';
import type { RoleExecutor } from '../codex/planning.js';
import { SAMPLE_STAGES, sampleContext, sampleAdmission, samplePlan,sampleSuggestedPlan, type SampleContext } from './context.js';
import { storedMedia, artifactBytes, verifySampleGeneratedReceipt } from './media.js';
import { buildSamplePacket, samplePacket, packetImages, sampleReviewSchema, validateSampleReview, validateSampleCompletion } from './review.js';
import { sampleMediaResultSchema, validateSampleMediaResult } from '../tool-gateway/sample-tools.js';
import {SampleListeningGateway,SampleListeningReader} from './listening.js';
import {verifySampleNativeLive} from './context.js';
import {preflightSampleNative} from './native-media.js';

export class SampleProductionService {
  private executor: RoleExecutor;
  constructor(private pool: pg.Pool, private cfg: Config, private store: ObjectStorage, executor?: RoleExecutor,private gateway?:GenerationGateway,private listening?:SampleListeningGateway) {
    requireThat((!executor&&!gateway&&!listening) || cfg.env === 'test', 'TEST_PORT_FORBIDDEN', '样例角色替身只可用于显式测试环境', 500);
    this.executor = executor ?? new CodexRuntimeAdapter(pool, cfg);
  }
  private async execute(request: RoleRequest, signal: AbortSignal): Promise<RoleResult> {
    const prior = (await this.pool.query<{ id: string; instance_id: string; state: string; input_hash: string; output_hash: string; private: { stage_result?: unknown } }>(`SELECT * FROM agent_runs
      WHERE tenant_id=$1 AND private->>'stage_run_id'=$2 AND role=$3 ORDER BY created_at DESC LIMIT 1`, [request.lease.tenant_id, request.lease.id, request.role])).rows[0];
    if (!prior) return this.executor.execute(request, signal);
    requireThat(prior.input_hash === request.lease.input_hash, 'SAMPLE_ROLE_CHECKPOINT_CHANGED', '样例原角色输入摘要不一致', 503);
    if (['UNKNOWN','RUNNING','LOADING_SKILLS'].includes(prior.state)) throw new PendingExternal(5, 'SAMPLE_PREVIOUS_ROLE_UNRESOLVED');
    requireThat(prior.state === 'SUCCEEDED' && prior.output_hash && hash(prior.private.stage_result) === prior.output_hash, 'SAMPLE_ROLE_FAILED', '样例原角色未成功完成，不能重新购买未知推理', 422);
    return { runId: prior.id, instanceId: prior.instance_id, result: prior.private.stage_result, resultHash: prior.output_hash };
  }
  async handle(lease: StageLease, signal: AbortSignal): Promise<StageCommit> {
    requireThat(lease.scope_type === 'SAMPLE' && SAMPLE_STAGES.includes(lease.stage_name as typeof SAMPLE_STAGES[number]), 'SAMPLE_STAGE_INVALID', '样例阶段无效', 500);
    const context = await transaction(this.pool, async db => {
      await assertLease(db, lease); const c = await sampleContext(db, lease.tenant_id, lease.scope_id, lease.input_hash, true);
      await db.query(`UPDATE public_samples SET state='GENERATING',data=data||'{"state":"GENERATING"}'::jsonb,updated_at=now() WHERE tenant_id=$1 AND id=$2`, [lease.tenant_id, lease.scope_id]); return c;
    });
    sampleAdmission(this.cfg, context);
    await verifySampleNativeLive(this.pool,this.cfg,context);
    await preflightSampleNative(this.pool,this.cfg,this.store,context);
    if (lease.stage_name === 'SAMPLE_QC') {
      let packet = await buildSamplePacket(this.pool, this.cfg, this.store, context, signal);
      if(context.input.generation?.audio){
        const listening=await (this.listening??new SampleListeningGateway(this.pool,this.cfg,this.store)).review(lease,context,packet,signal);
        const {packet_hash:_,...body}=packet;const sealed={...body,listening};packet={...sealed,packet_hash:hash(sealed)};
      }
      return async db => {
        const current = await sampleContext(db, lease.tenant_id, lease.scope_id, lease.input_hash, true);
        requireThat(!current.private.qc_packet || hash(current.private.qc_packet) === hash(packet), 'SAMPLE_PACKET_CHANGED', '样例原封存包不可替换', 503);
        await db.query(`UPDATE public_samples SET private=private||jsonb_build_object('qc_packet',$3::jsonb),updated_at=now() WHERE tenant_id=$1 AND id=$2`, [lease.tenant_id, lease.scope_id, JSON.stringify(packet)]);
      };
    }
    if (lease.stage_name === 'SAMPLE_COMPLETE') return this.finalize(lease, context);
    if(lease.stage_name==='SAMPLE_PRODUCTION'&&context.input.generation)await prepareSampleReferences(this.pool,this.cfg,this.store,lease,context,this.executor,this.gateway??sampleGenerationGateway(this.pool,this.cfg,this.store),signal);
    const role = lease.stage_name === 'SAMPLE' ? 'CONTENT' : lease.stage_name.slice(7) as RoleRequest['role'];
    const common = { lease, role, variantId: context.input.skill_variant_id, bundleHash: context.input.bundle_hash,
      admission: sampleAdmission(this.cfg, context), limits: context.input.limits, maxToolCalls: 32, maxScopeToolCalls: 160 };
    let request: RoleRequest;
    if (role === 'CONTENT') request = { ...common, allowedTools: ['analyze_photos','validate_content_plan','persist_stage_result'], outputSchema: creativePlanSchema,
      input: { phase: 'CONTENT', task: '根据作者本人商品证据和已选风格规划完整样例。调用analyze_photos，校验完整计划后持久化，未知属性不得编造。若 source.creative_components.community_direction 存在，必须保留 suggested_plan 的镜头起止帧、所选运镜和叙事标签；只在真实照片证据范围内选图与完善配套内容。',
        profile: context.input.profile, source: context.input.source, suggested_plan: sampleSuggestedPlan(context) } };
    else if (role === 'PRODUCTION' || role === 'POST') request = { ...common, allowedTools: [role === 'PRODUCTION' ? context.input.generation?'render_generated_pack':'render_photo_pack' : 'execute_post_plan','inspect_actual_media','persist_stage_result'], outputSchema: sampleMediaResultSchema,
      input: { phase: role, snapshot_hash: context.inputHash, creative_plan: samplePlan(context), source: context.input.source,
        task: '调用本阶段制作工具，再inspect_actual_media检测全部artifact_ids。将返回的tool_receipt_id加入tool_receipt_ids，通过persist_stage_result保存完整结果并原样返回。必须遵守原冻结路线及声音策略；有声方案保留原声、使用实际转写字幕，不得静音、二次配音、更换商品、追加预算或重新购买未知任务。' } };
    else {
      const packet = samplePacket(context); const images = await packetImages(this.pool, this.cfg, this.store, context, packet);
      if(context.input.generation?.audio)await new SampleListeningReader(this.pool,this.cfg,this.store).evidence(context,packet);
      request = { ...common, allowedTools: ['extract_review_evidence','persist_stage_result'], outputSchema: sampleReviewSchema, review: { packetHash: packet.packet_hash, images,...(packet.listening?{native_listening:packet.listening}:{}) },
        input: { phase: role, packet_hash: packet.packet_hash, profile: context.input.profile, source: context.input.source, creative_plan: samplePlan(context), packet,...(packet.listening?{native_listening:packet.listening}:{}),
          task: `独立执行${role === 'REVIEW_FACTS' ? '商品事实、身份、文字和规格' : '风格、节奏、可读性和体验'}复核。调用extract_review_evidence并查看全部随附实际PNG及视频采样。有声方案须交叉核对packet.native_audio的实际ASR与packet.listening的完整原声/交付听音结果，不能声称自己直接听过。只对全部素材都符合时给PASS，问题必须绑定实际asset_id。通过persist_stage_result保存报告并原样返回。` } };
    }
    const result = await this.execute(request, signal);
    requireThat(hash(result.result) === result.resultHash, 'SAMPLE_ROLE_CHECKPOINT_CHANGED', '样例角色结果摘要不一致', 503);
    return async db => {
      const current = await sampleContext(db, lease.tenant_id, lease.scope_id, lease.input_hash, true);
      const run = (await db.query<{ state: string; output_hash: string; input_hash: string }>('SELECT state,output_hash,input_hash FROM agent_runs WHERE tenant_id=$1 AND id=$2', [lease.tenant_id, result.runId])).rows[0];
      requireThat(run?.state === 'SUCCEEDED' && run.output_hash === result.resultHash && run.input_hash === lease.input_hash, 'SAMPLE_ROLE_CHECKPOINT_CHANGED', '样例角色缺少已完成持久证据', 503);
      if (role === 'CONTENT') {
        validateCreativePlan(result.result as CreativePlan, current.input.profile, current.input.source);
        requireThat(!current.private.creative || current.private.creative_hash === result.resultHash, 'SAMPLE_PLAN_CHANGED', '样例内容计划不可替换', 409);
        await db.query(`UPDATE public_samples SET private=private||jsonb_build_object('creative',$3::jsonb,'creative_hash',$4::text),updated_at=now() WHERE tenant_id=$1 AND id=$2`, [lease.tenant_id, lease.scope_id, JSON.stringify(result.result), result.resultHash]);
      } else if (role === 'PRODUCTION' || role === 'POST') await validateSampleMediaResult(db, current, result.runId, result.result);
      else await validateSampleReview(db, this.cfg, current, result.runId, result.result, true);
      await db.query(`UPDATE stage_runs SET private=private||jsonb_build_object('role_run_id',$3::text,'result_hash',$4::text) WHERE tenant_id=$1 AND id=$2`, [lease.tenant_id, lease.id, result.runId, result.resultHash]);
    };
  }
  private async finalize(lease: StageLease, context: SampleContext): Promise<StageCommit> {
    await validateSampleCompletion(this.pool, this.cfg, context); const packet = samplePacket(context); const receipt = storedMedia(context, 'POST');
    await packetImages(this.pool, this.cfg, this.store, context, packet);
    for (const artifact of receipt.artifacts) await artifactBytes(this.pool, this.store, context, artifact);
    await verifySampleGeneratedReceipt(this.pool,this.cfg,this.store,context,receipt);
    if(context.input.generation?.audio)await new SampleListeningReader(this.pool,this.cfg,this.store).evidence(context,packet);
    return async db => {
      const current = await sampleContext(db, lease.tenant_id, lease.scope_id, lease.input_hash, true); await validateSampleCompletion(db, this.cfg, current);
      requireThat(samplePacket(current).packet_hash === packet.packet_hash && hash(storedMedia(current, 'POST')) === hash(receipt), 'SAMPLE_PACKET_CHANGED', '样例封存包在提交前已变化', 503);
      for(const artifact of receipt.artifacts)await artifactBytes(db,this.store,current,artifact);
      await verifySampleGeneratedReceipt(db,this.cfg,this.store,current,receipt);
      if(current.input.generation?.audio)await new SampleListeningReader(db,this.cfg,this.store).evidence(current,samplePacket(current));
      const media = receipt.artifacts.filter(a => a.kind !== 'copy').map(a => ({ item_id: a.artifact_id, kind: a.kind, object_key: a.object_key, sha256: a.sha256, size_bytes: a.size_bytes }));
      await db.query(`UPDATE public_samples SET state='READY',data=data||'{"state":"READY"}'::jsonb,updated_at=now(),
        private=private||jsonb_build_object('media',$3::jsonb,'qc_passed',true,'completion',$4::jsonb) WHERE tenant_id=$1 AND id=$2 AND state='GENERATING'`,
      [lease.tenant_id, lease.scope_id, JSON.stringify(media), JSON.stringify({ input_hash: current.inputHash, packet_hash: packet.packet_hash, media_hash: hash(media), review_hash: hash(current.private.review_reports) })]);
    };
  }
}
