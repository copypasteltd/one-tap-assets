import {sampleGenerationGateway} from '../samples/generation.js';
import { setTimeout as delay } from 'node:timers/promises';
import { config } from '../../api/config.js';
import { createPool } from '../../api/db/pool.js';
import { migrate } from '../../api/db/migrate.js';
import { storage } from '../../api/storage/storage.js';
import { reconcileUncertainObjectWrites } from '../../api/storage/private-objects.js';
import { deletionJournal } from '../../api/privacy/journal.js';
import { id } from '../../api/lib/crypto.js';
import { WorkerRuntime, errorCode } from '../runtime.js';
import { MediaErasureService } from './media-erasure.js';
import { VisionAnalysisService } from '../analysis/service.js';
import { InferenceGateway } from '../codex/inference.js';
import { expireAuthorizedSamples } from '../../api/modules/authorized-samples.js';
import {GenerationGateway} from '../generation/gateway.js';
import {SpeechGateway} from '../speech/gateway.js';
import {NativeListeningGateway} from '../audio/listening-gateway.js';
import {SampleSpeechGateway} from '../samples/speech.js';
import {SampleListeningGateway} from '../samples/listening.js';

const cfg = config(); const pool = createPool(cfg); const controller = new AbortController(); const workerId = id('media_cleanup');
for (const signal of ['SIGINT','SIGTERM'] as const) process.once(signal, () => controller.abort());
const log = (event: Record<string, unknown>): void => { process.stdout.write(`${JSON.stringify({ at: new Date().toISOString(), ...event })}\n`); };
try {
  await migrate(pool); const store = storage(cfg); const media = new MediaErasureService(pool, store, workerId, deletionJournal(cfg));
  const vision = new VisionAnalysisService(pool, cfg, store); const inference = new InferenceGateway(pool, cfg, store);
  const generation=new GenerationGateway(pool,cfg,store),sampleGeneration=sampleGenerationGateway(pool,cfg,store);
  const speech=new SpeechGateway(pool,cfg,store);
  const listening=new NativeListeningGateway(pool,cfg,store);
  const sampleSpeech=new SampleSpeechGateway(pool,cfg,store),sampleListening=new SampleListeningGateway(pool,cfg,store);
  const events = new WorkerRuntime({ pool, workerId, stages: {}, events: { PrivacyDeletionRequested: event => media.requestEvent(event) }, log });
  let lastScan = -Infinity; log({ event: 'media_maintenance_ready', worker_id: workerId });
  do {
    if (Date.now() - lastScan >= 60000) {
      lastScan = Date.now();
      try {
        const objects = await reconcileUncertainObjectWrites(pool, store);
        if (objects.recovered || objects.blocked) log({ event: 'private_object_writes_reconciled', ...objects });
        const receipts = [await vision.reconcileReceipts(), await inference.reconcileReceipts(),await generation.reconcileReceipts(20,controller.signal),await sampleGeneration.reconcileReceipts(20,controller.signal),await speech.reconcileReceipts(),await listening.reconcileReceipts(),await sampleSpeech.reconcileReceipts(),await sampleListening.reconcileReceipts()];
        if (receipts.some(r => r.settled || r.blocked)) log({ event: 'private_receipts_reconciled', receipts });
        await expireAuthorizedSamples(pool); await media.expire(); await media.refreshPending();
      }
      catch (error) { log({ event: 'media_maintenance_scan_deferred', code: errorCode(error) }); }
    }
    await events.tick(controller.signal); await media.eraseOne(controller.signal);
    if (process.argv.includes('--once')) break;
    await delay(1000, undefined, { signal: controller.signal }).catch(() => {});
  } while (!controller.signal.aborted);
} catch (error) { if (!controller.signal.aborted) { log({ event: 'media_maintenance_stopped_with_error', code: errorCode(error) }); process.exitCode = 1; } }
finally {
  controller.abort();
  await pool.query(`UPDATE worker_heartbeats SET last_seen_at=now(),data=data||'{"state":"STOPPED"}'::jsonb WHERE id=$1`, [workerId]).catch(() => {});
  await pool.end();
}
