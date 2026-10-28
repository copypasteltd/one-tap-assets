import { setTimeout as delay } from 'node:timers/promises';
import { config } from '../../api/config.js';
import { createPool } from '../../api/db/pool.js';
import { migrate } from '../../api/db/migrate.js';
import { id } from '../../api/lib/crypto.js';
import { WorkerRuntime, errorCode } from '../runtime.js';
import { InstanceReaper } from './reaper.js';

const cfg = config(); const pool = createPool(cfg); const controller = new AbortController(); const workerId = id('reaper');
for (const signal of ['SIGINT','SIGTERM'] as const) process.once(signal, () => controller.abort());
const log = (event: Record<string, unknown>): void => { process.stdout.write(`${JSON.stringify({ at: new Date().toISOString(), ...event })}\n`); };
try {
  await migrate(pool); const reaper = new InstanceReaper(pool, cfg, workerId);
  const events = new WorkerRuntime({ pool, workerId, stages: {}, events: { ReleaseRequested: event => reaper.requestEvent(event) }, log });
  let lastScan = -Infinity; log({ event: 'reaper_ready', worker_id: workerId });
  do {
    if (Date.now() - lastScan >= 60000) {
      lastScan = Date.now(); const requested = await reaper.scanOrphans();
      if (requested) log({ event: 'orphan_release_requested', count: requested });
      const overdue = (await pool.query<{ n: string }>(`SELECT count(*) AS n FROM agent_instances WHERE state<>'RELEASED'
        AND cleanup_requested_at<clock_timestamp()-interval '10 minutes'`)).rows[0]!;
      if (Number(overdue.n)) log({ event: 'cleanup_overdue', count: Number(overdue.n) });
    }
    await events.tick(controller.signal); await reaper.releaseOne(controller.signal);
    if (process.argv.includes('--once')) break;
    await delay(1000, undefined, { signal: controller.signal }).catch(() => {});
  } while (!controller.signal.aborted);
} catch (error) { if (!controller.signal.aborted) { log({ event: 'reaper_stopped_with_error', code: errorCode(error) }); process.exitCode = 1; } }
finally {
  controller.abort();
  await pool.query(`UPDATE worker_heartbeats SET last_seen_at=now(),data=data||'{"state":"STOPPED"}'::jsonb WHERE id=$1`, [workerId]).catch(() => {});
  await pool.end();
}
