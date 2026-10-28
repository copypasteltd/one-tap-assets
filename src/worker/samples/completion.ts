import type { Db } from '../../api/db/pool.js';
import type { Config } from '../../api/config.js';
import { storage } from '../../api/storage/storage.js';
import { hash } from '../../api/lib/crypto.js';
import { requireThat } from '../../api/lib/errors.js';
import { sampleContext } from './context.js';
import { storedMedia, artifactBytes } from './media.js';
import { samplePacket, packetImages, validateSampleCompletion } from './review.js';
import { FONT_BINDING, verifyResourceLicenses } from '../media/font.js';

/** Publication rechecks actual production evidence, never a caller's QC flag. */
export async function verifyCompletedSample(db: Db, cfg: Config, tenantId: string, sampleId: string, state: Record<string, unknown>): Promise<void> {
  if (cfg.env === 'test' && state.test_fixture === true && !state.execution) return;
  requireThat(state.execution, 'SAMPLE_EXECUTION_UNVERIFIED', '样例缺少独立制作与复核证据', 422);
  const c = await sampleContext(db, tenantId, sampleId, undefined, false, true);
  await verifyResourceLicenses(db, [FONT_BINDING]);
  await validateSampleCompletion(db, cfg, c);
  const packet = samplePacket(c); const receipt = storedMedia(c, 'POST');
  const media = receipt.artifacts.filter(a => a.kind !== 'copy').map(a => ({ item_id: a.artifact_id, kind: a.kind,
    object_key: a.object_key, sha256: a.sha256, size_bytes: a.size_bytes }));
  requireThat(c.private.qc_passed === true && hash(c.private.media) === hash(media)
    && hash(c.private.completion) === hash({ input_hash: c.inputHash, packet_hash: packet.packet_hash, media_hash: hash(media), review_hash: hash(c.private.review_reports) }),
  'SAMPLE_COMPLETION_CHANGED', '样例交付证据或文件清单已变化', 503);
  const store = storage(cfg); await packetImages(db, cfg, store, c, packet);
  for (const artifact of receipt.artifacts) await artifactBytes(db, store, c, artifact);
}
