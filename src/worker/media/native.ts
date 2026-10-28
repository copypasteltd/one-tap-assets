import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile, realpath, stat } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import type { Config } from '../../api/config.js';
import { inside } from '../../api/config.js';
import { AppError, requireThat } from '../../api/lib/errors.js';
import { object } from '../../shared/domain/json.js';

export async function nativeCommand(cfg: Config, binary: string, args: string[], options: { cwd: string; timeoutMs: number; maxOutputBytes?: number; signal?: AbortSignal }): Promise<string> {
  requireThat(!options.signal?.aborted && Number.isFinite(options.timeoutMs) && options.timeoutMs > 0,
    'NATIVE_ABORTED', '原生媒体执行已取消或期限无效', 409);
  const cwd = inside(cfg.runtimeRoot, options.cwd); await mkdir(cwd, { recursive: true });
  const temp = inside(cfg.runtimeRoot, 'tmp'); await mkdir(temp, { recursive: true });
  requireThat(!/^(?:docker|wsl|podman|vagrant|multipass)(?:\.exe)?$/i.test(binary.split(/[\\/]/).at(-1) ?? ''), 'VIRTUALIZATION_FORBIDDEN', '禁止调度虚拟化运行时', 500);
  return new Promise((resolvePromise, reject) => {
    const child = spawn(binary, args, { cwd, windowsHide: true, shell: false, stdio: ['ignore', 'pipe', 'pipe'],
      env: { PATH: process.env.PATH ?? '', SystemRoot: process.env.SystemRoot ?? '', TEMP: temp, TMP: temp,
        ...(process.platform === 'win32' ? { WINDIR: process.env.WINDIR ?? '' } : { LANG: 'C.UTF-8' }) } });
    let stdout = ''; let stderr = ''; let overLimit = false; let timedOut = false;
    const max = options.maxOutputBytes ?? 1_000_000;
    const stop = (): void => { child.kill('SIGKILL'); };
    const timer = setTimeout(() => { timedOut = true; stop(); }, Math.max(1, options.timeoutMs)); timer.unref();
    options.signal?.addEventListener('abort', stop, { once: true });
    if (options.signal?.aborted) stop();
    child.stdout.on('data', (b: Buffer) => { if (Buffer.byteLength(stdout) + b.length > max) { overLimit = true; stop(); } else stdout += b.toString('utf8'); });
    child.stderr.on('data', (b: Buffer) => { stderr = (stderr + b.toString('utf8')).slice(-8192); });
    child.once('error', () => { clearTimeout(timer); options.signal?.removeEventListener('abort', stop); reject(new AppError('NATIVE_TOOL_UNAVAILABLE', '原生媒体程序不可用，请检查平台工具配置', 503)); });
    child.once('close', code => {
      clearTimeout(timer); options.signal?.removeEventListener('abort', stop);
      if (code !== 0 || overLimit || timedOut || options.signal?.aborted) { reject(new AppError(options.signal?.aborted ? 'NATIVE_ABORTED' : 'NATIVE_EXECUTION_FAILED', '媒体程序未完成处理', 503, false, [{ field: 'native', reason: overLimit ? 'OUTPUT_LIMIT' : timedOut ? 'DEADLINE_REACHED' : `EXIT_${String(code)}:${stderr.replaceAll(cfg.runtimeRoot, '[runtime]').slice(-1000)}` }])); return; }
      resolvePromise(stdout);
    });
  });
}
export interface MediaInspection { kind: 'image' | 'video'; width: number; height: number; codec: string; pixelFormat: string | null; fps: number | null; frames: number | null; durationSeconds: number | null; hasAudio: boolean; audioCodec: string | null; bytes: number }
export async function inspectVideo(cfg: Config, path: string, signal?: AbortSignal): Promise<MediaInspection> {
  const file = inside(cfg.runtimeRoot, path); inside(cfg.runtimeRoot, await realpath(file));
  const raw = await nativeCommand(cfg, process.env.FFPROBE_PATH?.trim() || 'ffprobe', ['-v', 'error', '-protocol_whitelist', 'file,pipe', '-count_frames', '-show_streams', '-show_format', '-of', 'json', file], { cwd: dirname(file), timeoutMs: 30000, ...(signal ? { signal } : {}) });
  const parsed = object(JSON.parse(raw) as unknown); const streams = Array.isArray(parsed.streams) ? parsed.streams.map(object) : [];
  const video = streams.find(s => s.codec_type === 'video'); const audio = streams.find(s => s.codec_type === 'audio');
  requireThat(video, 'VIDEO_STREAM_MISSING', '视频缺少可解码画面', 422);
  const [n, d] = String(video.avg_frame_rate ?? '0/1').split('/').map(Number); const fps = n && d ? n / d : 0;
  const frames = Number(video.nb_read_frames ?? video.nb_frames);
  const result: MediaInspection = { kind: 'video', width: Number(video.width), height: Number(video.height), codec: String(video.codec_name), pixelFormat: typeof video.pix_fmt === 'string' ? video.pix_fmt : null,
    fps, frames: Number.isSafeInteger(frames) ? frames : null, durationSeconds: Number(object(parsed.format).duration), hasAudio: !!audio, audioCodec: audio ? String(audio.codec_name) : null, bytes: (await stat(file)).size };
  requireThat(Number.isSafeInteger(result.width) && Number.isSafeInteger(result.height) && result.width > 0 && result.height > 0 && Number.isFinite(fps) && fps > 0, 'VIDEO_METADATA_INVALID', '视频实际规格无效', 422);
  return result;
}
export async function writeRuntime(cfg: Config, relativePath: string, bytes: Buffer): Promise<string> {
  const path = inside(cfg.runtimeRoot, relativePath); await mkdir(dirname(path), { recursive: true }); await writeFile(path, bytes, { flag: 'wx' }); return path;
}
export const readRuntime = async (cfg: Config, path: string): Promise<Buffer> => readFile(inside(cfg.runtimeRoot, await realpath(inside(cfg.runtimeRoot, path))));
