import { it, expect } from 'vitest';
import sharp from 'sharp';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolve, join } from 'node:path';
import type { Config } from '../../src/api/config.js';
import { renderLayout, STYLES } from '../../src/worker/media/layout.js';
import { renderPhotoVideo } from '../../src/worker/media/photo-video.js';
import { sha256 } from '../../src/api/lib/crypto.js';
import { basePlan } from '../../src/worker/compiler/plan.js';
import { profile, variant } from '../helpers/fixtures.js';
it('renders ten different original-photo layouts and decodes a native 30fps portrait video', async () => {
  const path = resolve('runtime/test-media', randomUUID()); await mkdir(path, { recursive: true });
  const cfg = { runtimeRoot: resolve('runtime') } as Config;
  const photo = await sharp({ create: { width: 800, height: 1000, channels: 3, background: '#2675A4' } }).png().toBuffer();
  const rendered: string[] = [];
  try {
    for (const presetId of Object.keys(STYLES)) {
      const bytes = await renderLayout(photo, { presetId, width: 1080, height: 1080, title: '蓝色带盖杯', subtitle: '可见蓝色 · 带杯盖', sequence: 1, total: 4 });
      const meta = await sharp(bytes).metadata(); expect(meta.width).toBe(1080); expect(meta.height).toBe(1080); expect(meta.format).toBe('png'); expect(meta.exif).toBeUndefined();
      // The original photograph remains visible without generative replacement.
      const pixel = await sharp(bytes).extract({ left: 540, top: 540, width: 1, height: 1 }).removeAlpha().raw().toBuffer(); expect([...pixel]).toEqual([38, 117, 164]);
      rendered.push(sha256(bytes)); await writeFile(join(path, `${presetId}.png`), bytes);
    }
    expect(new Set(rendered).size).toBe(10);
    const p = profile(); const plan = basePlan(p, variant()); plan.target_frames = 30;
    plan.shots = [{ ...plan.shots[0]!, start_frame: 0, end_frame: 30 }];
    const output = await renderPhotoVideo(cfg, { directory: path, plan, presetId: 'minimal-clean', photos: new Map(p.photo_roles.map(r => [r.asset_id, photo])), deadlineAt: new Date(Date.now() + 90000).toISOString() });
    expect(output.inspection).toMatchObject({ codec: 'h264', pixelFormat: 'yuv420p', fps: 30, frames: 30, width: 1080, height: 1920, hasAudio: false });
    // This is a synthetic smoke result, not a 14-variant customer-quality run.
  } finally { await rm(path, { recursive: true, force: true }); }
});
