import sharp from 'sharp';
import type { Db } from '../../api/db/pool.js';
import { hash, sha256 } from '../../api/lib/crypto.js';
import { requireThat } from '../../api/lib/errors.js';
import type { ToolScope } from '../tool-gateway/http.js';
import type { CodexAdmission } from './admission.js';
import type {ListeningEvidence} from '../audio/listening-gateway.js';

export interface ReviewImageBinding { asset_id: string; sha256: string; width: number; height: number }
export interface ReviewImage extends ReviewImageBinding { bytes: Buffer }
export interface ReviewInput { packet_hash: string; context_text: string; images: ReviewImageBinding[]; purpose?: 'REFERENCE_IDENTITY'; native_listening?:ListeningEvidence }
export async function checkReviewImage(image: ReviewImage, admission: CodexAdmission): Promise<void> {
  const policy = admission.review_vision;
  requireThat(policy && image.bytes.length <= policy.max_image_bytes && sha256(image.bytes) === image.sha256,
    'REVIEW_IMAGE_INVALID', '复核图片缺少准入、超限或摘要不一致', 422);
  const decoded = sharp(image.bytes, { limitInputPixels: policy.max_image_pixels, failOn: 'warning' }); const meta = await decoded.metadata();
  requireThat(meta.format === 'png' && meta.width === image.width && meta.height === image.height && (!meta.pages || meta.pages === 1)
    && !meta.exif && !meta.xmp && image.width * image.height <= policy.max_image_pixels,
  'REVIEW_IMAGE_INVALID', '复核图片实际格式、像素或元数据不符合封存绑定', 422);
  await decoded.raw().toBuffer();
}
export async function checkReviewImages(images: ReviewImage[], admission: CodexAdmission): Promise<void> {
  const policy = admission.review_vision;
  requireThat(policy && images.length > 0 && images.length <= policy.max_images
    && new Set(images.map(i => i.asset_id)).size === images.length
    && images.reduce((n, i) => n + i.bytes.length, 0) <= policy.max_total_image_bytes,
  'REVIEW_VISION_NOT_ADMITTED', '完整复核画面超出已认证的视觉/费用范围', 503);
  for (const image of images) await checkReviewImage(image, admission);
}
export function inputImages(input: unknown): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const visit = (v: unknown): void => {
    if (Array.isArray(v)) { for (const item of v) visit(item); }
    else if (v && typeof v === 'object') { const item = v as Record<string, unknown>;
      if (item.type === 'input_image') out.push(item); else for (const child of Object.values(item)) visit(child);
    }
  }; visit(input); return out;
}
/** Only exact bytes approved for this fresh review run may cross the egress.
 * No hosted URLs/file IDs, implicit resize, missing middle frames or text-only
 * review request can establish complete visual evidence. */
export async function authorizeReviewImages(db: Db, scope: ToolScope, input: unknown, admission: CodexAdmission): Promise<{
  input_bound_extra: number; image_hashes: string[]; binding_hash: string | null; text_input: unknown;
}> {
  const found = inputImages(input); const review = scope.role === 'REVIEW_FACTS' || scope.role === 'REVIEW_STYLE';
  if (!review) { requireThat(found.length === 0, 'CODEX_INFERENCE_TOOL_FORBIDDEN', '当前角色不能提交图片推理', 403);
    return { input_bound_extra: 0, image_hashes: [], binding_hash: null, text_input: input }; }
  const row = (await db.query<{ private: { review_input?: ReviewInput } }>('SELECT private FROM agent_runs WHERE tenant_id=$1 AND id=$2', [scope.tenant_id, scope.run_id])).rows[0];
  const binding = row?.private.review_input;
  requireThat(binding && admission.review_vision && binding.packet_hash === scope.packet_hash && binding.images.length > 0
    && found.length === binding.images.length, 'REVIEW_IMAGE_INPUT_INCOMPLETE', '独立复核必须提交本包全部实际画面', 422);
  const texts = (Array.isArray(input) ? input : []).flatMap((v: unknown) => {
    if (!v || typeof v !== 'object' || (v as Record<string, unknown>).role !== 'user') return [];
    const content = (v as Record<string, unknown>).content;
    if (typeof content === 'string') return [content];
    return Array.isArray(content) ? content.filter(c => c?.type === 'input_text' && typeof c.text === 'string').map(c => c.text as string) : [];
  });
  requireThat(binding.context_text && texts.some(t => t.includes(binding.context_text)),
    'REVIEW_CONTEXT_INPUT_INCOMPLETE', '独立复核必须包含本包合同、实际文案和时间码索引', 422);
  const images: ReviewImage[] = [];
  for (const [i, item] of found.entries()) {
    requireThat(Object.keys(item).every(k => ['type', 'image_url', 'detail'].includes(k)) && item.detail === admission.review_vision.detail
      && typeof item.image_url === 'string' && /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(item.image_url),
    'REVIEW_IMAGE_INPUT_INVALID', '复核只允许冻结图片的原始PNG字节和明确细节级别', 422);
    const base64 = item.image_url.slice('data:image/png;base64,'.length); const bytes = Buffer.from(base64, 'base64');
    requireThat(bytes.toString('base64') === base64, 'REVIEW_IMAGE_INPUT_INVALID', '图片编码不是规范Base64', 422);
    images.push({ ...binding.images[i]!, bytes });
  }
  await checkReviewImages(images, admission);
  const strip = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(strip);
    if (v && typeof v === 'object') { const item = v as Record<string, unknown>;
      if (item.type === 'input_image') return { ...item, image_url: '[certified-image-payload]' };
      return Object.fromEntries(Object.entries(item).map(([k, value]) => [k, strip(value)]));
    } return v;
  };
  return { input_bound_extra: images.length * admission.review_vision.tokens_per_image_bound,
    image_hashes: images.map(i => i.sha256), binding_hash: hash(binding), text_input: strip(input) };
}
