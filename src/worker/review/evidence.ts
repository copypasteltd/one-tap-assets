import { mkdir, readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import type { Config } from '../../api/config.js';
import { requireThat } from '../../api/lib/errors.js';
import { nativeCommand } from '../media/native.js';

export const FRAME_SAMPLING_POLICY = 'YPCC-FULL-TIMELINE-1S-SCENE-025-1.0';
export const RANGE_FRAME_SAMPLING_POLICY = 'YPCC-SELECTED-RANGE-1S-SCENE-025-1.0';
export interface EvidenceFrame { index: number; timeMs: number; bytes: Buffer }
export interface EvidenceRange { start_frame: number; end_frame: number }
/** Absolute source indices. Sampling starts at the explicitly selected range,
 * and includes its last frame and every required boundary without thinning. */
export function requiredEvidenceFrameIndices(frames: number, boundaries: number[], range?: EvidenceRange): number[] {
  requireThat(Number.isSafeInteger(frames) && frames > 0 && frames <= 108001, 'REVIEW_VIDEO_INVALID', '审查视频帧数无效', 422);
  const start = range?.start_frame ?? 0, end = range?.end_frame ?? frames;
  requireThat(Number.isSafeInteger(start) && Number.isSafeInteger(end) && start >= 0 && end <= frames && end > start,
    'REVIEW_RANGE_INVALID', '审查选段必须位于已确认的原视频内', 422);
  const required = new Set<number>([start, end - 1]);
  for (let n = start; n < end; n += 30) required.add(n);
  for (const n of boundaries) if (Number.isSafeInteger(n) && n >= start && n < end) required.add(n);
  requireThat(required.size <= 900, 'REVIEW_EVIDENCE_LIMIT', '完整选段审查证据超过当前规则容量', 422);
  return [...required].sort((a, b) => a - b);
}
/** Decode the complete stream, sample every second, every planned boundary,
 * the last frame, and actual scene changes. A selected source range is trimmed
 * before scene detection; returned indices still refer to the original file. */
export async function extractEvidenceFrames(cfg: Config, videoPath: string, directory: string, frames: number,
  boundaries: number[], deadlineAt: string, signal: AbortSignal, range?: EvidenceRange): Promise<EvidenceFrame[]> {
  const required = requiredEvidenceFrameIndices(frames, boundaries, range);
  const start = range?.start_frame ?? 0, end = range?.end_frame ?? frames;
  await mkdir(directory, { recursive: true });
  const selected = required.map(n => `eq(n\\,${n - start})`).join('+');
  const trim = range ? `trim=start_frame=${start}:end_frame=${end},setpts=PTS-STARTPTS,` : '';
  await nativeCommand(cfg, process.env.FFMPEG_PATH?.trim() || 'ffmpeg', ['-hide_banner', '-loglevel', 'error', '-xerror', '-nostdin', '-y',
    '-threads', '2', '-filter_threads', '1', '-protocol_whitelist', 'file,pipe', '-i', videoPath, '-map', '0:v:0', '-an',
    '-vf', `${trim}select=${selected}+gt(scene\\,0.25),metadata=mode=print:file=frame-times.txt`,
    '-fps_mode', 'vfr', '-frames:v', '1001', '-c:v', 'png', '-threads', '2', join(directory, 'frame-%06d.png')],
  { cwd: directory, timeoutMs: Math.max(1, Math.min(120000, Date.parse(deadlineAt) - Date.now())), signal });
  const metadataPath = join(directory, 'frame-times.txt');
  requireThat((await stat(metadataPath)).size <= 1_000_000, 'REVIEW_EVIDENCE_LIMIT', '视频时间码证据超限', 422);
  const metadata = await readFile(metadataPath, 'utf8');
  const times = [...metadata.matchAll(/^frame:\s*(\d+)\s+pts:\s*(-?\d+)\s+pts_time:([0-9.e+-]+)/gm)];
  const files = (await readdir(directory)).filter(f => /^frame-\d{6}\.png$/.test(f)).sort();
  requireThat(files.length > 0 && files.length <= 900 && files.length === times.length, 'REVIEW_EVIDENCE_LIMIT', '全片取帧缺失或超过当前规则容量', 422);
  const evidence: EvidenceFrame[] = []; let totalBytes = 0;
  for (const [i, file] of files.entries()) {
    const seconds = Number(times[i]![3]); const index = start + Math.round(seconds * 30);
    requireThat(Number(times[i]![1]) === i && Number.isFinite(seconds) && index >= start && index < end
      && (!i || index > evidence[i - 1]!.index), 'REVIEW_TIMECODE_INVALID', '实际视频取帧时间码不连续或无效', 503);
    const path = join(directory, file);
    const size = (await stat(path)).size; totalBytes += size;
    requireThat(size <= 30_000_000 && totalBytes <= 128_000_000, 'REVIEW_EVIDENCE_LIMIT', '完整帧证据超过内存处理上限', 422);
    evidence.push({ index, timeMs: Math.round(index * 1000 / 30), bytes: await readFile(path) });
  }
  requireThat(required.every(n => evidence.some(e => e.index === n)), 'REVIEW_EVIDENCE_INCOMPLETE', '缺少完整选段固定采样或分镜边界画面', 503);
  return evidence;
}
