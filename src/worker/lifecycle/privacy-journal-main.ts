import { config } from '../../api/config.js';
import { createPool } from '../../api/db/pool.js';
import { migrate } from '../../api/db/migrate.js';
import { DeletionJournal } from '../../api/privacy/journal.js';
import { requireThat } from '../../api/lib/errors.js';
import { errorCode } from '../runtime.js';
import { bootstrapDeletionJournal, replayDeletionJournal, finishPrivacyRestore } from './privacy-restore.js';

const cfg = config(); const pool = createPool(cfg); const command = process.argv[2];
const checkpoint = process.argv.find(a => a.startsWith('--expected-head-sha256='))?.slice('--expected-head-sha256='.length);
const output = (value: unknown): void => { process.stdout.write(JSON.stringify(value) + '\n'); };
try {
  await migrate(pool); const journal = new DeletionJournal(cfg);
  if (command === 'initialize') output({ event: 'privacy_journal_initialized', ...await bootstrapDeletionJournal(pool, cfg) });
  else if (command === 'status') {
    const head = await journal.readHead(); let ready = false; let code: string | null = null;
    try { await journal.assertReady(pool); ready = true; } catch (error) { code = errorCode(error); }
    output({ event: 'privacy_journal_status', source_id: journal.sourceId, head_sha256: head.sha256, sequence: head.head.sequence, ready, code });
  } else {
    requireThat(checkpoint && /^[a-f0-9]{64}$/.test(checkpoint), 'PRIVACY_JOURNAL_CHECKPOINT_REQUIRED', 'block/replay/finish需要数据库外固定的检查点摘要', 422);
    if (command === 'block') { await journal.blockRestore(checkpoint); output({ event: 'privacy_restore_blocked', head_sha256: checkpoint }); }
    else if (command === 'replay') output({ event: 'privacy_deletions_replayed', ...await replayDeletionJournal(pool, cfg, checkpoint) });
    else if (command === 'finish') { await finishPrivacyRestore(pool, cfg, checkpoint); output({ event: 'privacy_restore_replayed', head_sha256: checkpoint, financial_recovery_required: true }); }
    else requireThat(false, 'PRIVACY_JOURNAL_COMMAND_INVALID', '使用initialize/status/block/replay/finish', 422);
  }
} catch (error) { output({ event: 'privacy_journal_command_failed', code: errorCode(error) }); process.exitCode = 1; }
finally { await pool.end(); }
