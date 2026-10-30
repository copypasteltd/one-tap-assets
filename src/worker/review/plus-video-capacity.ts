import {requireThat} from '../../api/lib/errors.js';
import {plusVideoBinding} from '../../shared/domain/plus-video.js';
import type {FrozenContract} from '../compiler/snapshot.js';
import {requiredEvidenceFrameIndices} from './evidence.js';

/** A lower-bound check before payment. Scene changes, actual PNG bytes and
 * complete text are still checked against the frozen admission at runtime. */
export function checkPlusVideoReviewCapacity(contract:FrozenContract,originalPhotoCount:number):void{
  const b=plusVideoBinding(contract.source);if(!b)return;
  const vision=contract.runtime_binding?.admission.review_vision;
  requireThat(vision&&Number.isSafeInteger(originalPhotoCount)&&originalPhotoCount>0,
    'PLUS_VIDEO_REVIEW_NOT_ADMITTED','视频复核能力或原商品照片证明不完整',503);
  const target=b.settings.trim.end_frame-b.settings.trim.start_frame;
  const captionFrames=b.settings.captions.flatMap(c=>[c.start_frame,Math.floor((c.start_frame+c.end_frame-1)/2),c.end_frame-1]);
  const outputBoundaries=[...contract.creative.shots.flatMap(s=>[s.start_frame,s.end_frame-1]),...captionFrames];
  const sourceFrames=requiredEvidenceFrameIndices(b.source_frames,captionFrames.map(n=>n+b.settings.trim.start_frame),b.settings.trim);
  const outputFrames=requiredEvidenceFrameIndices(target,outputBoundaries);
  const minimumImages=originalPhotoCount+sourceFrames.length+outputFrames.length+contract.source.output_slots.filter(s=>s.kind==='image').length;
  requireThat(minimumImages<=vision.max_images&&minimumImages*vision.tokens_per_image_bound+contract.runtime_binding!.admission.input_overhead_tokens<contract.codex_contract.max_input_tokens,
    'PLUS_VIDEO_REVIEW_CAPACITY_EXCEEDED','选段或字幕的最低复核画面已超过当前能力，请缩短选段或减少字幕后重新整理清单',422);
  requireThat(b.source_width*b.source_height<=vision.max_image_pixels&&b.settings.canvas.width*b.settings.canvas.height<=vision.max_image_pixels,
    'PLUS_VIDEO_REVIEW_PIXELS_EXCEEDED','原片或输出画面的像素超过当前复核能力，请选择更小的规格或可复核原片',422);
}
