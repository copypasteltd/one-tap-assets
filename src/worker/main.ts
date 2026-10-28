import { config } from '../api/config.js';
import { createPool } from '../api/db/pool.js';
import { migrate } from '../api/db/migrate.js';
import { storage } from '../api/storage/storage.js';
import { id } from '../api/lib/crypto.js';
import { WorkerRuntime, errorCode, type StageHandler, type EventHandler } from './runtime.js';
import { PaymentReconciler } from './payments/reconcile.js';
import { VisionAnalysisService } from './analysis/service.js';
import { prewarmSkills } from './codex/skills.js';
import { ToolConsumer, type ToolHandler } from './tool-gateway/consumer.js';
import { contentTools } from './tool-gateway/content-tools.js';
import { ContentPlanningService } from './codex/planning.js';
import { MediaStageService } from './codex/media-stage.js';
import { productionTools } from './tool-gateway/production-tools.js';
import { QualityControlService } from './review/qc.js';
import { ReviewStageService } from './review/stage.js';
import { PublicationService } from './review/publication.js';
import { deletionJournal } from '../api/privacy/journal.js';
import { reviewTools } from './tool-gateway/review-tools.js';
import { SampleProductionService } from './samples/service.js';
import { SAMPLE_STAGES } from './samples/context.js';
import { sampleTools } from './tool-gateway/sample-tools.js';
import { PublicSamplePreparationService } from './samples/publication.js';
import { OptionalPreviewService } from './previews/service.js';
import {RevisionService} from './revisions/service.js';
import {REVISION_STAGES} from './revisions/contract.js';
import {revisionTools} from './tool-gateway/revision-tools.js';

const cfg = config(); const pool = createPool(cfg); const controller = new AbortController();
const workerId = id('worker');
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => controller.abort());
const log = (event: Record<string, unknown>): void => { process.stdout.write(`${JSON.stringify({ at: new Date().toISOString(), ...event })}\n`); };
try {
  await migrate(pool);
  const journal = deletionJournal(cfg); await journal?.assertReady(pool);
  const admissionGuard = async (): Promise<void> => { await journal?.assertReady(pool); };
  const skills = await prewarmSkills(cfg);
  const payments = new PaymentReconciler(pool, cfg);
  const analysis = new VisionAnalysisService(pool, cfg, storage(cfg));
  const stages: Record<string, StageHandler> = {};
  const events: Record<string, EventHandler> = {};
  if (cfg.publishingEnabled) {
    const samples = new PublicSamplePreparationService(pool,cfg,storage(cfg));
    stages.PUBLIC_SAMPLE_PREPARE = (lease,signal)=>samples.handle(lease,signal);
  }
  if (cfg.generationEnabled) stages.ANALYZE = (lease, signal) => analysis.handle(lease, signal);
  if (cfg.generationEnabled) { const previews=new OptionalPreviewService(pool,cfg,storage(cfg)); stages.PREVIEW=(lease,signal)=>previews.handle(lease,signal); }
  if (cfg.codex.enabled) { const planning = new ContentPlanningService(pool, cfg); stages.PLAN = (lease, signal) => planning.handle(lease, signal); }
  if (cfg.codex.enabled && cfg.generationEnabled) {
    const media = new MediaStageService(pool, cfg);
    stages.PRODUCTION = (lease, signal) => media.handle(lease, signal);
    stages.POST = (lease, signal) => media.handle(lease, signal);
    const qc = new QualityControlService(pool, cfg, storage(cfg));
    stages.QC = (lease, signal) => qc.handle(lease, signal);
    const review = new ReviewStageService(pool, cfg);
    stages.REVIEW_FACTS = (lease, signal) => review.handle(lease, signal);
    stages.REVIEW_STYLE = (lease, signal) => review.handle(lease, signal);
    const publication = new PublicationService(pool, cfg, storage(cfg));
    stages.DELIVER = (lease, signal) => publication.handle(lease, signal);
    const samples = new SampleProductionService(pool, cfg, storage(cfg));
    for (const name of SAMPLE_STAGES) stages[name] = (lease, signal) => samples.handle(lease, signal);
    const revisions=new RevisionService(pool,cfg,storage(cfg));
    for(const name of REVISION_STAGES)stages[name]=(lease,signal)=>revisions.handle(lease,signal);
  }
  if (cfg.paymentsEnabled) {
    events.PaymentRequested = event => payments.create(event.tenant_id, event.aggregate_id);
    events.PaymentQueryRequested = event => payments.query(event.tenant_id, event.aggregate_id);
    events.RefundRequested = event => payments.refund(event.tenant_id, event.aggregate_id);
  }
  const required = ['ANALYZE', 'PLAN', 'PRODUCTION', 'POST', 'QC', 'REVIEW_FACTS', 'REVIEW_STYLE', 'DELIVER', 'PREVIEW', ...REVISION_STAGES, ...SAMPLE_STAGES];
  const missing = required.filter(name => !stages[name]);
  // An operational recovery worker is useful during development. Production
  // generation must not start while any required product stage is missing.
  if (cfg.env === 'production' && cfg.generationEnabled && missing.length) throw new Error('Full production stage registry is incomplete');
  const content = contentTools(pool); const mediaTools = productionTools(pool, cfg, storage(cfg));
  const reviews = reviewTools(pool, cfg, storage(cfg));
  const orderTools: Record<string, ToolHandler> = { ...content, ...mediaTools, ...reviews,
    persist_stage_result: (scope, args, intent, signal) => (scope.role === 'CONTENT' ? content
      : scope.role === 'REVIEW_FACTS' || scope.role === 'REVIEW_STYLE' ? reviews : mediaTools).persist_stage_result!(scope, args, intent, signal) };
  const samples = sampleTools(pool, cfg, storage(cfg));
  const revisions=revisionTools(pool,cfg,storage(cfg));
  const handlers: Record<string, ToolHandler> = {};
  for (const name of new Set([...Object.keys(orderTools), ...Object.keys(samples)])) handlers[name] = (scope, args, intent, signal) => {
    const handler = (scope.scope_type==='REVISION'?revisions:scope.scope_type === 'SAMPLE' ? samples : orderTools)[name];
    if (!handler) throw new Error('Tool is unavailable in this scope');
    return handler(scope, args, intent, signal);
  };
  const tools = new ToolConsumer(pool, `${workerId}-tools`, handlers, log, admissionGuard);
  const runtime = new WorkerRuntime({ pool, workerId, stages, events, log,
    scheduleReconciliation: () => payments.scheduleReconciliation(), admissionGuard });
  log({ event: 'worker_ready', worker_id: workerId, skill_cache: skills, stage_handlers: Object.keys(stages),
    event_handlers: Object.keys(events), incomplete_stages: missing, stage_registry_complete: missing.length === 0 });
  if (process.argv.includes('--once')) { await runtime.tick(controller.signal); await tools.process(controller.signal); }
  else await Promise.all([runtime.run(controller.signal), tools.run(controller.signal)]);
} catch (error) {
  log({ event: 'worker_stopped_with_error', code: errorCode(error) }); process.exitCode = 1;
} finally {
  controller.abort();
  await pool.query(`UPDATE worker_heartbeats SET last_seen_at=now(),data=data||'{"state":"STOPPED"}'::jsonb WHERE id=$1`, [workerId]).catch(() => {});
  await pool.end();
}
