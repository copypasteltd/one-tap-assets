import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Config } from '../../api/config.js';
import { inside } from '../../api/config.js';
import type { CreativePlan } from '../compiler/plan.js';
import { renderLayout } from './layout.js';
import { nativeCommand, inspectVideo, type MediaInspection } from './native.js';
import { requireThat } from '../../api/lib/errors.js';
import type { ProductionFont } from './font.js';
import type {CaptionStyle} from '../../shared/domain/creative-components.js';

export async function renderPhotoVideo(cfg: Config, input: { directory: string; plan: CreativePlan; presetId: string; photos: Map<string, Buffer>; deadlineAt: string; signal?: AbortSignal; font?: ProductionFont;captionStyle?:CaptionStyle }): Promise<{ bytes: Buffer; inspection: MediaInspection; path: string }> {
  const dir = inside(cfg.runtimeRoot, input.directory); await mkdir(dir, { recursive: true }); const plan = input.plan;
  for (const [index, shot] of plan.shots.entries()) {
    requireThat(shot.end_frame > shot.start_frame && shot.overlap_frames === 0, 'TIMELINE_INVALID', '照片短片时间轴无效', 422);
    const photo = input.photos.get(shot.asset_id); requireThat(photo, 'PHOTO_MISSING', '缺少本单商品照片', 422);
    const frame = await renderLayout(photo, { presetId: input.presetId, width: 1080, height: 1920, title: plan.title,
      subtitle: shot.intent, sequence: index + 1, total: plan.shots.length, ...(input.font ? { font: input.font } : {}),...(input.captionStyle?{captionStyle:input.captionStyle}:{}) });
    const still = join(dir, `shot-${index}.png`); const part = join(dir, `shot-${index}.mp4`); await writeFile(still, frame);
    const frames = shot.end_frame - shot.start_frame;
    const zoom = shot.camera === 'HOLD' ? '1' : 'min(1.035,1+on*0.00025)';
    const x = shot.camera === 'PAN' ? '(iw-iw/zoom)*on/' + Math.max(1, frames - 1) : '(iw-iw/zoom)/2';
    await nativeCommand(cfg, process.env.FFMPEG_PATH?.trim() || 'ffmpeg', ['-hide_banner', '-loglevel', 'error', '-nostdin', '-y', '-threads', '2', '-filter_threads', '1', '-protocol_whitelist', 'file,pipe',
      '-loop', '1', '-i', still, '-vf', `zoompan=z='${zoom}':x='${x}':y='(ih-ih/zoom)/2':d=1:s=1080x1920:fps=30,setsar=1,format=yuv420p`,
      '-frames:v', String(frames), '-r', '30', '-c:v', 'libx264', '-threads', '2', '-preset', 'veryfast', '-crf', '21', '-pix_fmt', 'yuv420p', '-an', '-movflags', '+faststart', part],
    { cwd: dir, timeoutMs: Math.max(1, Math.min(180000, Date.parse(input.deadlineAt) - Date.now())), ...(input.signal ? { signal: input.signal } : {}) });
  }
  // Names are platform generated, relative to the bounded working directory.
  const concat = join(dir, 'parts.ffconcat'); await writeFile(concat, 'ffconcat version 1.0\n' + plan.shots.map((_, i) => `file shot-${i}.mp4\n`).join(''));
  const path = join(dir, 'video.mp4');
  await nativeCommand(cfg, process.env.FFMPEG_PATH?.trim() || 'ffmpeg', ['-hide_banner', '-loglevel', 'error', '-nostdin', '-y', '-protocol_whitelist', 'file,pipe', '-safe', '1', '-f', 'concat', '-i', concat, '-c', 'copy', '-movflags', '+faststart', path],
    { cwd: dir, timeoutMs: Math.max(1, Math.min(30000, Date.parse(input.deadlineAt) - Date.now())), ...(input.signal ? { signal: input.signal } : {}) });
  const inspection = await inspectVideo(cfg, path, input.signal);
  requireThat(inspection.width === 1080 && inspection.height === 1920 && inspection.codec === 'h264' && inspection.pixelFormat === 'yuv420p' && inspection.fps === 30
    && inspection.frames !== null && Math.abs(inspection.frames - plan.target_frames) <= 1 && !inspection.hasAudio, 'MEDIA_CONTRACT_FAILED', '短片实际规格未通过交付检查', 422);
  return { bytes: await readFile(path), inspection, path };
}
