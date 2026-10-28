import { open, mkdir, lstat, readdir, rename, unlink } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import type { Db } from '../db/pool.js';
import type { Config } from '../config.js';
import { inside } from '../config.js';
import { AppError, requireThat } from '../lib/errors.js';
import { hash, hmac, equalSecret, id } from '../lib/crypto.js';

export interface DeletionIntent {
  schema_version: '1.0.0'; source_id: string; request_id: string; tenant_id: string; owner_id: string; created_at: string;
  scope: 'PRODUCT' | 'ACCOUNT_MEDIA'; product_ids: string[]; order_ids: string[]; asset_ids: string[];
  origin?: 'USER'|'RETENTION'; authorized_sample_ids?: string[];
}
export interface JournalHead { schema_version: '1.0.0'; source_id: string; key_id: string; sequence: number; entry_sha256: string; signature: string }
export interface JournalEntry { sequence: number; previous_sha256: string; intent: DeletionIntent; signature: string }
export interface JournalSnapshot { head: JournalHead; sha256: string; entries: JournalEntry[] }
const zero = '0'.repeat(64); const digest = /^[a-f0-9]{64}$/; const identifier = /^[A-Za-z0-9_-]{1,128}$/;
function exact(value: unknown, keys: string[]): asserts value is Record<string, unknown> {
  requireThat(value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === keys.length && keys.every(k => Object.hasOwn(value, k)), 'PRIVACY_JOURNAL_INVALID', '删除日志结构无效', 503);
}
function validIntent(raw: unknown, sourceId: string): asserts raw is DeletionIntent {
  const optional = raw && typeof raw==='object' ? ['origin','authorized_sample_ids'].filter(k=>Object.hasOwn(raw,k)) : [];
  exact(raw, ['schema_version','source_id','request_id','tenant_id','owner_id','created_at','scope','product_ids','order_ids','asset_ids',...optional]);
  requireThat(raw.schema_version === '1.0.0' && raw.source_id === sourceId
    && ['PRODUCT','ACCOUNT_MEDIA'].includes(String(raw.scope)) && ['request_id','tenant_id','owner_id'].every(k => typeof raw[k] === 'string' && identifier.test(raw[k] as string))
    && typeof raw.created_at === 'string' && Number.isFinite(Date.parse(raw.created_at)) && new Date(raw.created_at).toISOString() === raw.created_at,
  'PRIVACY_JOURNAL_INVALID', '删除日志范围无效', 503);
  requireThat(!Object.hasOwn(raw,'origin') || ['USER','RETENTION'].includes(String(raw.origin)) && (raw.origin!=='RETENTION' || raw.scope==='PRODUCT'),
    'PRIVACY_JOURNAL_INVALID','删除来源无效',503);
  for (const key of ['product_ids','order_ids','asset_ids',...(Object.hasOwn(raw,'authorized_sample_ids')?['authorized_sample_ids']:[])]) {
    const values = raw[key]; requireThat(Array.isArray(values) && values.length <= 100000 && values.every(v => typeof v === 'string' && identifier.test(v))
      && new Set(values).size === values.length, 'PRIVACY_JOURNAL_INVALID', '删除日志对象集合无效', 503);
  }
  requireThat(raw.scope !== 'PRODUCT' || (raw.product_ids as string[]).length === 1, 'PRIVACY_JOURNAL_INVALID', '商品删除日志需要一个商品', 503);
  requireThat(raw.origin!=='RETENTION' || !Array.isArray(raw.authorized_sample_ids) || raw.authorized_sample_ids.length===0,
    'PRIVACY_JOURNAL_INVALID','私有素材自然到期不能撤回独立公开授权',503);
}
/** A separate, signed filesystem journal. The production operator must provide
 * independent storage/ACL/backup and pin the latest head outside the DB backup.
 * fsync tests do not prove host power-loss or off-host durability. */
export class DeletionJournal {
  readonly sourceId: string; private root: string;
  constructor(private cfg: Config) {
    requireThat(cfg.privacyJournal.enabled, 'PRIVACY_JOURNAL_DISABLED', '删除日志尚未启用', 503);
    this.sourceId = cfg.privacyJournal.sourceId; this.root = inside(cfg.runtimeRoot, cfg.privacyJournal.directory);
  }
  private sign(value: unknown): string { return hmac(this.cfg.privacyJournal.hmacKey, hash(value)); }
  private async directory(create = false): Promise<void> {
    let current = this.cfg.projectRoot;
    for (const segment of relative(current, this.root).split(sep).filter(Boolean)) {
      current = join(current, segment);
      if (create) await mkdir(current, { recursive: false }).catch(error => { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; });
      const stat = await lstat(current); requireThat(stat.isDirectory() && !stat.isSymbolicLink(), 'PRIVACY_JOURNAL_PATH_UNSAFE', '删除日志目录必须为独立普通目录', 503);
    }
  }
  private async read(name: string, maxBytes: number): Promise<unknown> {
    await this.directory(); const path = join(this.root, name); const stat = await lstat(path);
    requireThat(stat.isFile() && !stat.isSymbolicLink() && stat.size > 0 && stat.size <= maxBytes,
      'PRIVACY_JOURNAL_INVALID', '删除日志文件无效', 503);
    const file = await open(path, 'r');
    try { const bytes = await file.readFile(); requireThat(bytes.length <= maxBytes, 'PRIVACY_JOURNAL_INVALID', '删除日志文件超过限制', 503); return JSON.parse(bytes.toString('utf8')) as unknown; }
    finally { await file.close(); }
  }
  private async writeNew(name: string, body: unknown): Promise<void> {
    await this.directory(true); const file = await open(join(this.root, name), 'wx', 0o600);
    try { await file.writeFile(JSON.stringify(body) + '\n'); await file.sync(); } finally { await file.close(); }
  }
  private async replace(name: string, body: unknown): Promise<void> {
    const temp = `${name}.${id('pending')}.tmp`; await this.writeNew(temp, body);
    await rename(join(this.root, temp), join(this.root, name));
  }
  private async locked<T>(action: () => Promise<T>): Promise<T> {
    await this.directory(true);
    let file;
    try { file = await open(join(this.root, 'writer.lock'), 'wx', 0o600); }
    catch { throw new AppError('PRIVACY_JOURNAL_LOCKED', '删除日志正在写入或需要故障恢复', 503, true); }
    try { await file.writeFile(JSON.stringify({ pid: process.pid, nonce: id('journal_writer') })); await file.sync(); return await action(); }
    finally { await file.close(); await unlink(join(this.root, 'writer.lock')); }
  }
  private head(sequence: number, entryHash: string): JournalHead {
    const value = { schema_version: '1.0.0' as const, source_id: this.sourceId, key_id: this.cfg.privacyJournal.keyId, sequence, entry_sha256: entryHash };
    return { ...value, signature: this.sign(value) };
  }
  async readHead(): Promise<{ head: JournalHead; sha256: string }> {
    const raw = await this.read('head.json', 4096);
    exact(raw, ['schema_version','source_id','key_id','sequence','entry_sha256','signature']);
    const { signature, ...unsigned } = raw;
    requireThat(raw.schema_version === '1.0.0' && raw.source_id === this.sourceId && raw.key_id === this.cfg.privacyJournal.keyId
      && Number.isSafeInteger(raw.sequence) && Number(raw.sequence) >= 0 && Number(raw.sequence) <= 1000000
      && typeof raw.entry_sha256 === 'string' && digest.test(raw.entry_sha256) && typeof signature === 'string' && equalSecret(this.sign(unsigned), signature)
      && (raw.sequence !== 0 || raw.entry_sha256 === zero), 'PRIVACY_JOURNAL_INVALID', '删除日志检查点签名或来源不一致', 503);
    const head = raw as unknown as JournalHead; return { head, sha256: hash(head) };
  }
  async snapshot(expectedSha256?: string): Promise<JournalSnapshot> {
    const { head, sha256 } = await this.readHead();
    if (expectedSha256 !== undefined) requireThat(digest.test(expectedSha256) && sha256 === expectedSha256, 'PRIVACY_JOURNAL_CHECKPOINT_MISMATCH', '恢复检查点与数据库外的删除日志不一致', 503);
    const entries: JournalEntry[] = []; let previous = zero; const requests = new Set<string>();
    const files = new Map<number, string>();
    for (const name of await readdir(this.root)) {
      const match = /^(\d{12})-([a-f0-9]{64})\.json$/.exec(name); if (!match) continue;
      const seq = Number(match[1]); requireThat(seq > 0 && seq <= head.sequence && !files.has(seq), 'PRIVACY_JOURNAL_INCOMPLETE', '删除日志存在未封存记录或分叉', 503); files.set(seq, name);
    }
    requireThat(files.size === head.sequence, 'PRIVACY_JOURNAL_INCOMPLETE', '删除日志记录缺失', 503);
    for (let seq = 1; seq <= head.sequence; seq++) {
      const name = files.get(seq)!; const raw = await this.read(name, 16_000_000);
      exact(raw, ['sequence','previous_sha256','intent','signature']); validIntent(raw.intent, this.sourceId);
      const { signature, ...unsigned } = raw;
      requireThat(raw.sequence === seq && raw.previous_sha256 === previous && typeof signature === 'string' && equalSecret(signature, this.sign(unsigned))
        && name === `${String(seq).padStart(12, '0')}-${hash(raw)}.json` && !requests.has(raw.intent.request_id), 'PRIVACY_JOURNAL_INVALID', '删除日志摘要链或签名不一致', 503);
      requests.add(raw.intent.request_id); previous = hash(raw); entries.push(raw as unknown as JournalEntry);
    }
    requireThat(previous === head.entry_sha256 && (await this.readHead()).sha256 === sha256, 'PRIVACY_JOURNAL_CHANGED', '核验期间删除日志已更新，请重试', 503);
    return { head, sha256, entries };
  }
  async assertReady(db: Db): Promise<void> {
    try { await this.ready(db); }
    catch (error) { throw new AppError(error instanceof AppError ? error.code : 'PRIVACY_JOURNAL_UNAVAILABLE', '服务维护中，请稍后重试', 503, true); }
  }
  private async ready(db: Db): Promise<void> {
    await this.directory();
    try { await lstat(join(this.root, 'restore-block.json')); throw new AppError('PRIVACY_RESTORE_PENDING', '数据恢复正在重放删除标记', 503, true); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    const { head, sha256 } = await this.readHead();
    const row = (await db.query<{ head_sha256: string; sequence: string; initialized: boolean; financial_recovery_required: boolean }>('SELECT * FROM privacy_journal_state WHERE source_id=$1', [this.sourceId])).rows[0];
    requireThat(row?.initialized && row.head_sha256 === sha256 && Number(row.sequence) === head.sequence,
      'PRIVACY_RESTORE_PENDING', '删除日志尚未初始化或恢复数据库需要先重放删除标记', 503);
    // A DB restore may also have lost paid intents/payment events. Privacy replay
    // cannot certify their recovery. Only a non-production, all-paid-flags-off
    // preview is admitted until independent financial recovery is implemented.
    requireThat(!row.financial_recovery_required || (this.cfg.env !== 'production' && !this.cfg.paymentsEnabled && !this.cfg.generationEnabled && !this.cfg.codex.enabled),
      'FINANCIAL_RESTORE_PENDING', '服务维护中，请稍后重试', 503);
  }
  async initialize(db: Db): Promise<void> {
    await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`privacy-journal:${this.sourceId}`]);
    await this.locked(async () => {
      let existing = false;
      try { await lstat(join(this.root, 'head.json')); existing = true; } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
      if (!existing) {
        const previous = (await db.query<{ sequence: string; initialized: boolean }>('SELECT sequence,initialized FROM privacy_journal_state WHERE source_id=$1', [this.sourceId])).rows[0];
        requireThat(!previous || (!previous.initialized && Number(previous.sequence) === 0), 'PRIVACY_JOURNAL_LOST', '已有独立日志丢失，不能重建空检查点', 503);
        await this.writeNew('head.json', this.head(0, zero));
      }
      const current = await this.snapshot();
      requireThat(current.head.sequence === 0, 'PRIVACY_JOURNAL_ALREADY_INITIALIZED', '已有删除日志必须核验或重放，不可重新初始化', 503);
      await db.query(`INSERT INTO privacy_journal_state(source_id,head_sha256,sequence,initialized) VALUES($1,$2,0,false)
        ON CONFLICT(source_id) DO NOTHING`, [this.sourceId, current.sha256]);
    });
  }
  async append(db: Db, intent: DeletionIntent, bootstrap = false): Promise<void> {
    validIntent(intent, this.sourceId);
    await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`privacy-journal:${this.sourceId}`]);
    await this.locked(async () => {
      if (!bootstrap) await this.assertReady(db);
      const current = await this.snapshot();
      requireThat(current.head.sequence < 1000000, 'PRIVACY_JOURNAL_CAPACITY', '删除日志需要先完成受控归档轮换', 503);
      const state = (await db.query<{ head_sha256: string }>('SELECT head_sha256 FROM privacy_journal_state WHERE source_id=$1 FOR UPDATE', [this.sourceId])).rows[0];
      requireThat(state?.head_sha256 === current.sha256, 'PRIVACY_RESTORE_PENDING', '数据库与删除日志检查点不同，必须先恢复重放', 503);
      const unsigned = { sequence: current.head.sequence + 1, previous_sha256: current.head.entry_sha256, intent };
      const entry: JournalEntry = { ...unsigned, signature: this.sign(unsigned) }; const entryHash = hash(entry);
      await this.writeNew(`${String(entry.sequence).padStart(12, '0')}-${entryHash}.json`, entry);
      const next = this.head(entry.sequence, entryHash); await this.replace('head.json', next);
      await db.query('INSERT INTO privacy_journal_receipts(source_id,sequence,entry_sha256,request_id) VALUES($1,$2,$3,$4)', [this.sourceId, entry.sequence, entryHash, intent.request_id]);
      await db.query('UPDATE privacy_journal_state SET head_sha256=$2,sequence=$3,updated_at=now() WHERE source_id=$1', [this.sourceId, hash(next), entry.sequence]);
    });
  }
  async blockRestore(expectedSha256: string): Promise<void> {
    requireThat(digest.test(expectedSha256), 'PRIVACY_JOURNAL_CHECKPOINT_REQUIRED', '恢复需要数据库外固定的删除日志检查点', 422);
    await this.locked(async () => { await this.snapshot(expectedSha256); await this.replace('restore-block.json', { source_id: this.sourceId, expected_sha256: expectedSha256 }); });
  }
  async unblockRestore(expectedSha256: string): Promise<void> {
    await this.locked(async () => {
      await this.snapshot(expectedSha256); const block = await this.read('restore-block.json', 4096);
      exact(block, ['source_id','expected_sha256']); requireThat(block.source_id === this.sourceId && block.expected_sha256 === expectedSha256, 'PRIVACY_RESTORE_PENDING', '恢复阻塞标记不匹配', 503);
      await unlink(join(this.root, 'restore-block.json'));
    });
  }
}
export function deletionJournal(cfg: Config): DeletionJournal | undefined { return cfg.privacyJournal.enabled ? new DeletionJournal(cfg) : undefined; }
