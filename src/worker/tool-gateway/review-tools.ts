import type pg from 'pg';
import type { Config } from '../../api/config.js';
import type { ObjectStorage } from '../../api/storage/storage.js';
import { hash } from '../../api/lib/crypto.js';
import { requireThat } from '../../api/lib/errors.js';
import { insert } from '../../api/db/store.js';
import { executionContext } from '../compiler/order-context.js';
import { currentReviewPacket, packetImages } from '../review/context.js';
import { reviewIdentity, validateReviewReport } from '../review/reports.js';
import type { ToolHandler } from './consumer.js';
import {referenceTools} from './reference-tools.js';

export function reviewTools(pool: pg.Pool, cfg: Config, store: ObjectStorage): Record<string, ToolHandler> {
  const references=referenceTools(pool,cfg,store);
  return {
    extract_review_evidence: async (scope, args, intent, signal) => {
      if(scope.stage_name==='PRODUCTION')return references.extract_review_evidence!(scope,args,intent,signal);
      requireThat(scope.order_id && (scope.role === 'REVIEW_FACTS' || scope.role === 'REVIEW_STYLE'), 'REVIEW_SCOPE_INVALID', '仅独立复核可以读取封存材料', 403);
      const context = await executionContext(pool, scope.tenant_id, scope.order_id, scope.snapshot_hash);
      const packet = await currentReviewPacket(pool, context);
      requireThat(packet.packet_hash === scope.packet_hash && args.packet_hash === packet.packet_hash, 'REVIEW_PACKET_STALE', '复核能力不属于当前封存包', 409);
      const images = await packetImages(pool, store, context, packet); const identity = await reviewIdentity(pool, cfg, context, packet, scope.run_id);
      return { result: { packet_hash: packet.packet_hash, output_set_hash: packet.output_set_hash,
        image_count: images.length, allowed_evidence_ids: [...packet.original_assets, ...packet.evidence_assets, ...packet.outputs.map(o => ({ asset_id: o.asset_id }))].map(e => e.asset_id),
        report_template: identity.template } };
    },
    persist_stage_result: async (scope, args, intent, signal) => {
      if(scope.stage_name==='PRODUCTION')return references.persist_stage_result!(scope,args,intent,signal);
      requireThat(scope.order_id && (scope.role === 'REVIEW_FACTS' || scope.role === 'REVIEW_STYLE'), 'REVIEW_SCOPE_INVALID', '此入口只接受独立复核结果', 403);
      const context = await executionContext(pool, scope.tenant_id, scope.order_id, scope.snapshot_hash); const packet = await currentReviewPacket(pool, context);
      requireThat(scope.packet_hash === packet.packet_hash, 'REVIEW_PACKET_STALE', '复核能力不属于当前封存包', 409);
      const report = await validateReviewReport(pool, cfg, context, packet, scope.run_id, args.result, true); const resultHash = hash(report);
      return { result: { persisted: true, result_hash: resultHash }, commit: async db => {
        const current = await executionContext(db, scope.tenant_id, scope.order_id!, scope.snapshot_hash); const latest = await currentReviewPacket(db, current);
        requireThat(latest.packet_hash === packet.packet_hash, 'REVIEW_PACKET_STALE', '提交时封存材料已经变化', 409);
        await validateReviewReport(db, cfg, current, latest, scope.run_id, report, true);
        const old = (await db.query<{ data: unknown }>('SELECT data FROM review_reports WHERE tenant_id=$1 AND id=$2', [scope.tenant_id, report.report_id])).rows[0];
        requireThat(!old || hash(old.data) === resultHash, 'REVIEW_RESULT_CHANGED', '已持久的复核报告不能替换', 409);
        if (!old) {
          const { run } = await reviewIdentity(db, cfg, current, latest, scope.run_id);
          await insert(db, 'review_reports', { id: report.report_id, tenant_id: scope.tenant_id, packet_id: packet.packet_id, run_id: scope.run_id,
            thread_id: report.thread_id, role: report.role, verdict: report.verdict, evidence_hash: hash(run.private.review_input), data: report });
        }
        const changed = await db.query(`UPDATE agent_runs SET output_hash=$3,checkpoint_hash=$3,
          private=private||jsonb_build_object('stage_result',$4::jsonb),updated_at=now() WHERE tenant_id=$1 AND id=$2 AND state='RUNNING'
          AND (output_hash IS NULL OR output_hash=$3)`, [scope.tenant_id, scope.run_id, resultHash, JSON.stringify(report)]);
        requireThat(changed.rowCount === 1, 'REVIEW_RESULT_CHANGED', '当前角色已结束或持久结果不能更换', 409);
      } };
    },
  };
}
