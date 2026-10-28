import sharp from 'sharp';
import type pg from 'pg';
import { writePrivateObject } from '../../api/storage/private-objects.js';
import type { Config } from '../../api/config.js';
import { transaction } from '../../api/db/pool.js';
import { insert } from '../../api/db/store.js';
import type { ObjectStorage } from '../../api/storage/storage.js';
import { AppError, requireThat, notFound } from '../../api/lib/errors.js';
import { hash, id, iso, sha256 } from '../../api/lib/crypto.js';
import { object } from '../../shared/domain/json.js';
import type { DTO } from '../../shared/contracts/types.js';
import type { StageCommit } from '../runtime.js';
import { assertLease, PendingExternal, type StageLease } from '../queue/leases.js';
import { reservePlatform, settlePlatform } from '../budget/platform.js';
import { VisionClient, visionContract, frozenVisionContract, prepareVision, costMicro, profileCandidate, type VisionImage, type VisionWireContract, type PreparedVision } from '../providers/vision.js';
import { normalizeVision } from './profile.js';

interface AnalysisRow { id: string; tenant_id: string; owner_id: string; product_id: string; photo_version_id: string; data: DTO<'Analysis'>; private: { vision_contract: VisionWireContract; vision_contract_hash: string } }
interface Submission { id: string; state: string; input_hash: string; reservation_id: string; private: { result_key: string; contract_hash: string; receipt_hash?: string; billing_valid?: boolean; http_status?: number; billing_error?: string } }
interface Receipt { status: number; response_sha256: string; body: unknown }
export class VisionAnalysisService {
  constructor(private pool: pg.Pool, private cfg: Config, private store: ObjectStorage, private client = new VisionClient(cfg)) {}
  async reconcileReceipts(limit = 20): Promise<{ settled: number; blocked: number }> {
    requireThat(Number.isSafeInteger(limit) && limit > 0 && limit <= 100, 'RECONCILIATION_LIMIT_INVALID', '对账批次无效', 500);
    const rows = (await this.pool.query<Submission & { tenant_id: string; object_sha256: string; contract: VisionWireContract; contract_hash: string }>(`SELECT s.*,
      w.sha256 AS object_sha256,a.private->'vision_contract' AS contract,a.private->>'vision_contract_hash' AS contract_hash
      FROM provider_submissions s JOIN stage_runs t ON t.tenant_id=s.tenant_id AND t.id=s.stage_run_id AND t.scope_type='ANALYSIS'
      JOIN analysis_jobs a ON a.tenant_id=t.tenant_id AND a.id=t.scope_id
      JOIN private_object_writes w ON w.tenant_id=s.tenant_id AND w.object_key=s.private->>'result_key'
        AND w.owner_id=a.owner_id AND w.product_id=a.product_id AND w.kind='RECEIPT' AND w.state='STORED'
      WHERE s.state IN ('SUBMITTING','UNKNOWN') ORDER BY s.updated_at,s.id LIMIT $1`, [limit])).rows;
    let settled = 0; let blocked = 0;
    for (const row of rows) {
      try {
        const contract = frozenVisionContract(row.contract);
        requireThat(hash(contract) === row.contract_hash && row.private.contract_hash === row.contract_hash,
          'VISION_CONTRACT_CHANGED', '原回执费用合同不一致', 503);
        const bytes = await this.store.get(row.private.result_key, 1_500_000);
        requireThat(sha256(bytes) === row.object_sha256, 'VISION_RECEIPT_HASH_MISMATCH', '原回执文件摘要不一致', 503);
        const receipt = JSON.parse(bytes.toString('utf8')) as Receipt;
        requireThat(receipt && Number.isInteger(receipt.status) && /^[a-f0-9]{64}$/.test(receipt.response_sha256),
          'VISION_RECEIPT_INVALID', '原回执格式不完整', 503);
        const result = await this.finishReceipt(row, row.tenant_id, contract, receipt);
        if (result.private.billing_valid) settled++; else blocked++;
      } catch (error) {
        blocked++;
        await this.pool.query(`UPDATE provider_submissions SET private=private||jsonb_build_object('reconciliation_error',$3::text),updated_at=now()
          WHERE tenant_id=$1 AND id=$2 AND state IN ('SUBMITTING','UNKNOWN')`, [row.tenant_id, row.id, error instanceof AppError ? error.code : 'VISION_RECEIPT_INVALID']);
      }
    }
    return { settled, blocked };
  }
  private async inputs(lease: StageLease): Promise<{ job: AnalysisRow; contract: VisionWireContract; images: VisionImage[] }> {
    const job = (await this.pool.query<AnalysisRow>('SELECT * FROM analysis_jobs WHERE tenant_id=$1 AND id=$2', [lease.tenant_id, lease.scope_id])).rows[0] ?? notFound();
    const contract = await visionContract(this.cfg);
    requireThat(job.private.vision_contract_hash === hash(contract) && hash(job.private.vision_contract) === hash(contract), 'VISION_CONTRACT_CHANGED', '识别配置已变更，请由平台重新核验任务', 503);
    const incident = await this.pool.query(`SELECT id FROM provider_submissions WHERE private @> $1::jsonb LIMIT 1`, [JSON.stringify({ contract_hash: hash(contract), contract_violation: true })]);
    requireThat(!incident.rowCount, 'VISION_CONTRACT_SUSPENDED', '识别费用或模型回执异常，该能力已暂停', 503);
    const product = (await this.pool.query<{ deleted_at: Date | null; expires_at: Date; current_photo_version: number }>('SELECT deleted_at,expires_at,current_photo_version FROM product_drafts WHERE tenant_id=$1 AND owner_id=$2 AND id=$3', [lease.tenant_id, job.owner_id, job.product_id])).rows[0];
    requireThat(product && !product.deleted_at && product.expires_at.getTime() > Date.now() && product.current_photo_version === job.data.photo_version, 'INPUT_VERSION_CHANGED', '商品照片已更新、删除或过期', 410);
    const assets = await this.pool.query<{ id: string; object_key: string; sha256: string }>(`SELECT a.id,a.object_key,a.sha256 FROM product_photo_items p
      JOIN assets a ON a.id=p.asset_id AND a.tenant_id=p.tenant_id WHERE p.tenant_id=$1 AND p.photo_version_id=$2
      AND a.owner_id=$3 AND a.product_id=$4 AND a.state='READY' AND a.expires_at>now() ORDER BY p.position`, [lease.tenant_id, job.photo_version_id, job.owner_id, job.product_id]);
    requireThat(assets.rows.length >= 3 && assets.rows.length <= 5, 'INPUT_EXPIRED', '识别照片不足或已过期，请重新拍摄', 410);
    const images: VisionImage[] = [];
    for (const asset of assets.rows) {
      const original = await this.store.get(asset.object_key, 125_000_000);
      requireThat(sha256(original) === asset.sha256, 'INPUT_HASH_MISMATCH', '原始照片校验失败', 503);
      const resized = await sharp(original, { limitInputPixels: 30_000_000, failOn: 'warning' }).resize({ width: contract.max_image_edge, height: contract.max_image_edge, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 90, chromaSubsampling: '4:4:4' }).toBuffer({ resolveWithObject: true });
      images.push({ assetId: asset.id, bytes: resized.data, width: resized.info.width, height: resized.info.height, sha256: sha256(resized.data) });
    }
    return { job, contract, images };
  }
  private async finishReceipt(submission: Submission, tenantId: string, contract: VisionWireContract, receipt: Receipt): Promise<Submission> {
    const successful = receipt.status >= 200 && receipt.status < 300;
    let actual: number | null = null; let billingError: string | null = null; let violation = false;
    const noCharge = !successful && contract.no_charge_http_statuses.includes(receipt.status);
    if (successful) {
      try {
        const body = object(receipt.body); const usage = object(body.usage);
        requireThat(body.model === contract.actual_model, 'VISION_MODEL_MISMATCH', '识别服务返回了未冻结的模型', 503);
        const input = usage.prompt_tokens; const output = usage.completion_tokens;
        requireThat(typeof input === 'number' && typeof output === 'number', 'VISION_USAGE_INVALID', '识别用量回执缺失', 503);
        actual = costMicro(input, output, contract);
        requireThat(input <= contract.certified_max_input_tokens && output <= contract.max_output_tokens && actual <= contract.per_request_ceiling_micro,
          'VISION_COST_BOUND_VIOLATED', '识别用量或费用超出已核验能力上界', 503);
      } catch (error) {
        billingError = error instanceof AppError ? error.code : 'VISION_USAGE_INVALID'; actual = null;
        violation = ['VISION_COST_BOUND_VIOLATED', 'VISION_MODEL_MISMATCH'].includes(billingError);
      }
    }
    return transaction(this.pool, async db => {
      const current = (await db.query<Submission>('SELECT * FROM provider_submissions WHERE id=$1 AND tenant_id=$2 FOR UPDATE', [submission.id, tenantId])).rows[0] ?? notFound();
      if (['SUCCEEDED', 'FAILED'].includes(current.state)) return current;
      await settlePlatform(db, tenantId, submission.reservation_id, actual, noCharge);
      const state = successful && !billingError ? 'SUCCEEDED' : 'FAILED';
      return (await db.query<Submission>(`UPDATE provider_submissions SET state=$3,updated_at=now(),data=data||jsonb_build_object('state',$3::text),
        private=private||$4::jsonb WHERE id=$1 AND tenant_id=$2 RETURNING *`, [submission.id, tenantId, state,
        JSON.stringify({ response_hash: receipt.response_sha256, receipt_hash: hash(receipt), billing_valid: actual !== null || noCharge, http_status: receipt.status,
          billing_error: billingError, contract_violation: violation })])).rows[0]!;
    });
  }
  private async original(lease: StageLease, job: AnalysisRow, contract: VisionWireContract, prepared: PreparedVision, ordinal: number, signal: AbortSignal): Promise<{ submission: Submission; receipt: Receipt }> {
    const intentKey = `vision:${job.id}:${ordinal}`;
    const claimed = await transaction(this.pool, async db => {
      await assertLease(db, lease);
      await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [intentKey]);
      const prior = (await db.query<Submission>('SELECT * FROM provider_submissions WHERE intent_key=$1 AND tenant_id=$2', [intentKey, lease.tenant_id])).rows[0];
      if (prior) { requireThat(prior.input_hash === prepared.requestHash, 'VISION_REQUEST_CHANGED', '同一识别意图的输入不可更换', 409); return { submission: prior, created: false }; }
      // Re-check input under a lock immediately before durable paid intent.
      const product = await db.query(`SELECT id FROM product_drafts WHERE tenant_id=$1 AND owner_id=$2 AND id=$3
        AND deleted_at IS NULL AND expires_at>now() AND current_photo_version=$4 FOR UPDATE`, [lease.tenant_id, job.owner_id, job.product_id, job.data.photo_version]);
      requireThat(product.rowCount === 1, 'INPUT_VERSION_CHANGED', '商品输入已撤销或更新', 410);
      const reservation = await reservePlatform(db, { tenantId: lease.tenant_id, ownerId: job.owner_id, category: 'VISION', dailyCeilingMicro: this.cfg.provider.visionDailyBudgetMicro },
        intentKey, contract.per_request_ceiling_micro, { provider: contract.provider, model: contract.actual_model, rate_version: contract.rate_version, contract_hash: prepared.contractHash });
      const submissionId = id('submission'); const resultKey = `${lease.tenant_id}/vision/${job.id}/${submissionId}.json`;
      await insert(db, 'provider_submissions', { id: submissionId, tenant_id: lease.tenant_id, stage_run_id: lease.id, intent_key: intentKey,
        input_hash: prepared.requestHash, state: 'SUBMITTING', reservation_id: reservation,
        data: { submission_id: submissionId, state: 'SUBMITTING', kind: 'VISION', attempt: ordinal },
        private: { analysis_id: job.id, result_key: resultKey, contract_hash: prepared.contractHash, request_summary: prepared.summary } });
      await db.query(`UPDATE analysis_jobs SET state='RUNNING',updated_at=now(),data=data||'{"state":"RUNNING"}'::jsonb WHERE tenant_id=$1 AND id=$2`, [lease.tenant_id, job.id]);
      const submission = (await db.query<Submission>('SELECT * FROM provider_submissions WHERE id=$1', [submissionId])).rows[0]!;
      return { submission, created: true };
    });
    let submission = claimed.submission;
    if (claimed.created) {
      try {
        const response = await this.client.submit(contract, prepared, submission.id, lease.deadline_at, signal);
        let body: unknown = null; try { body = response.json(); } catch { /* Persist hash and parse failure, never invent a valid profile. */ }
        const receipt: Receipt = { status: response.status, response_sha256: sha256(response.bytes), body };
        // A deterministic private key closes the object-write / DB-commit gap.
        await writePrivateObject(this.pool, this.store, { tenantId: lease.tenant_id, ownerId: job.owner_id,
          productId: job.product_id, kind: 'RECEIPT' }, submission.private.result_key, Buffer.from(JSON.stringify(receipt)), 'application/json');
        submission = await this.finishReceipt(submission, lease.tenant_id, contract, receipt);
        return { submission, receipt };
      } catch (error) {
        await transaction(this.pool, async db => {
          await db.query(`UPDATE provider_submissions SET state='UNKNOWN',updated_at=now(),data=data||'{"state":"UNKNOWN"}'::jsonb
            WHERE id=$1 AND tenant_id=$2 AND state='SUBMITTING'`, [submission.id, lease.tenant_id]);
          await settlePlatform(db, lease.tenant_id, submission.reservation_id, null);
        });
        throw new PendingExternal(5, signal.aborted ? 'VISION_REQUEST_INTERRUPTED' : 'VISION_REQUEST_UNKNOWN');
      }
    }
    if (!await this.store.exists(submission.private.result_key)) throw new PendingExternal(5, 'VISION_REQUEST_UNKNOWN');
    const receipt = JSON.parse((await this.store.get(submission.private.result_key, 1_500_000)).toString('utf8')) as Receipt;
    if (submission.private.receipt_hash) requireThat(hash(receipt) === submission.private.receipt_hash, 'VISION_RECEIPT_HASH_MISMATCH', '识别服务回执摘要不一致', 503);
    if (!['SUCCEEDED', 'FAILED'].includes(submission.state)) submission = await this.finishReceipt(submission, lease.tenant_id, contract, receipt);
    return { submission, receipt };
  }
  async handle(lease: StageLease, signal: AbortSignal): Promise<StageCommit> {
    const { job, contract, images } = await this.inputs(lease); const prepared = prepareVision(contract, images);
    const assetIds = images.map(i => i.assetId);
    let candidate: Record<string, unknown> | null = null; let needsPhotos: string[] = [];
    for (let ordinal = 1; ordinal <= 2; ordinal++) {
      const { submission, receipt } = await this.original(lease, job, contract, prepared, ordinal, signal);
      requireThat(submission.state === 'SUCCEEDED', submission.private.billing_error || 'VISION_PROVIDER_REJECTED', '识别服务未返回可核验的结果', 503);
      try {
        const body = object(receipt.body); const choices = body.choices;
        requireThat(Array.isArray(choices) && choices.length === 1, 'VISION_OUTPUT_INVALID', '识别服务结果结构无效', 422);
        const choice = object(choices[0]); const message = object(choice.message);
        requireThat(choice.finish_reason === 'stop' && !message.refusal && typeof message.content === 'string', 'VISION_OUTPUT_INVALID', '识别结果不完整或未被服务接受', 422);
        candidate = profileCandidate(JSON.parse(message.content) as unknown);
        const normalized = normalizeVision(candidate, { tenantId: lease.tenant_id, productId: job.product_id, photoVersion: job.data.photo_version, revision: 1, assetIds });
        if (normalized.profile.conflicts.length) needsPhotos.push('CONFLICTING_PRODUCT_IDENTITY');
        if (!normalized.profile.photo_roles.some(p => p.role === 'WHOLE')) needsPhotos.push('WHOLE_PRODUCT_PHOTO_REQUIRED');
        break;
      } catch (error) {
        if (error instanceof AppError && ['VISION_UNIDENTIFIED', 'IDENTITY_EVIDENCE_INSUFFICIENT'].includes(error.code)) { needsPhotos = ['CLEAR_PRODUCT_PHOTOS_REQUIRED']; candidate = null; break; }
        await this.pool.query(`UPDATE provider_submissions SET private=private||jsonb_build_object('validation_error',$2::text) WHERE id=$1`, [submission.id, error instanceof AppError ? error.code : 'VISION_OUTPUT_INVALID']);
        if (ordinal === 2) throw new AppError('VISION_OUTPUT_INVALID', '两次识别结果均未通过证据校验，请稍后重试或联系平台', 422);
      }
    }
    return async db => {
      const product = (await db.query<{ deleted_at: Date | null; expires_at: Date; current_photo_version: number; revision: number; data: DTO<'Product'> }>('SELECT * FROM product_drafts WHERE tenant_id=$1 AND owner_id=$2 AND id=$3 FOR UPDATE', [lease.tenant_id, job.owner_id, job.product_id])).rows[0];
      requireThat(product && !product.deleted_at && product.expires_at.getTime() > Date.now() && product.current_photo_version === job.data.photo_version, 'INPUT_VERSION_CHANGED', '商品输入已更新，旧识别结果不能覆盖', 409);
      if (needsPhotos.length) {
        await db.query(`UPDATE analysis_jobs SET state='NEEDS_PHOTOS',updated_at=now(),data=data||$3::jsonb WHERE tenant_id=$1 AND id=$2`, [lease.tenant_id, job.id,
          JSON.stringify({ state: 'BLOCKED', profile_id: null, reason_codes: needsPhotos, updated_at: iso() })]); return;
      }
      requireThat(candidate, 'VISION_OUTPUT_INVALID', '缺少经验证的照片识别结果', 503);
      const revision = Number((await db.query<{ n: number }>('SELECT COALESCE(max(revision),0)+1 AS n FROM profile_versions WHERE tenant_id=$1 AND product_id=$2', [lease.tenant_id, job.product_id])).rows[0]!.n);
      const { profile, identityLock } = normalizeVision(candidate, { tenantId: lease.tenant_id, productId: job.product_id, photoVersion: job.data.photo_version, revision, assetIds });
      await insert(db, 'profile_versions', { id: profile.profile_id, tenant_id: lease.tenant_id, owner_id: job.owner_id, product_id: job.product_id,
        photo_version_id: job.photo_version_id, revision, profile_hash: profile.profile_hash, data: profile,
        private: { analysis_id: job.id, model: contract.actual_model, contract_hash: prepared.contractHash, prompt_version: 'vision-evidence-1.1' } });
      await insert(db, 'identity_locks', { id: identityLock.identity_lock_id, tenant_id: lease.tenant_id, profile_id: profile.profile_id, hash: identityLock.content_hash, data: identityLock });
      await db.query(`UPDATE product_drafts SET current_profile_id=$3,revision=revision+1,updated_at=now(),data=$4::jsonb WHERE tenant_id=$1 AND id=$2`, [lease.tenant_id, job.product_id,
        profile.profile_id, JSON.stringify({ ...product.data, profile_id: profile.profile_id, revision: product.revision + 1 })]);
      await db.query(`UPDATE analysis_jobs SET state='SUCCEEDED',updated_at=now(),data=data||$3::jsonb WHERE tenant_id=$1 AND id=$2`, [lease.tenant_id, job.id,
        JSON.stringify({ state: 'READY', profile_id: profile.profile_id, reason_codes: [], updated_at: iso() })]);
    };
  }
}
