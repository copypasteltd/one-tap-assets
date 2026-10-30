import { chromium, expect } from '@playwright/test';
import { build } from 'esbuild';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { local, sha, snapshot } from './delivery/common.js';

// Actual React/component/hook execution with a synthetic native page lifecycle and read-only recommendation data.
const before = await snapshot();
process.env.PLAYWRIGHT_BROWSERS_PATH ??= local('runtime/playwright-browsers');
const fixture = `import React from 'react';import {createRoot} from 'react-dom/client';
import {ProductRecommendations} from ${JSON.stringify(local('src/shared/ui/recommendations.tsx'))};
window.trace={requests:[],show:[],hide:[],initial_show_sent:false};
function Host(){const [ready,setReady]=React.useState(false);React.useEffect(()=>{window.trace.initial_show_sent=true;for(const fn of window.trace.show)fn();const timer=setTimeout(()=>setReady(true),20);return()=>clearTimeout(timer);},[]);
return ready?<ProductRecommendations profile={{product_id:'synthetic-product',profile_id:'synthetic-profile',photo_version:1}}/>:null;}
window.root=createRoot(document.getElementById('root'));window.root.render(<Host/>);`;
const result = await build({ stdin: { contents: fixture, resolveDir: process.cwd(), loader: 'tsx', sourcefile: 'runtime/tmp/mini-mount-harness.tsx' },
  bundle: true, write: false, platform: 'browser', format: 'iife', define: { 'process.env.NODE_ENV': '"test"' },
  plugins: [{ name: 'native-page-lifecycle-fixture', setup(b) {
    b.onResolve({ filter: /^@tarojs\/components$/ }, () => ({ path: local('src/preview/components.tsx') }));
    b.onResolve({ filter: /^@tarojs\/taro$/ }, () => ({ path: 'lifecycle', namespace: 'fixture' }));
    b.onResolve({ filter: /^\.\/runtime$/ }, a => a.importer.endsWith('/ui/recommendations.tsx') || a.importer.endsWith('\\ui\\recommendations.tsx') ? { path: 'client', namespace: 'fixture' } : undefined);
    b.onResolve({ filter: /^\.\.\/client\/recommendations$/ }, () => ({ path: 'recommendations', namespace: 'fixture' }));
    b.onLoad({ filter: /.*/, namespace: 'fixture' }, a => ({ loader: 'js', contents: a.path === 'client' ? 'export const client=()=>({});' : a.path === 'lifecycle'
      ? `import {useEffect} from 'react';export function useDidShow(fn){useEffect(()=>{window.trace.show.push(fn);return()=>{window.trace.show=window.trace.show.filter(x=>x!==fn)}},[])};export function useDidHide(fn){useEffect(()=>{window.trace.hide.push(fn);return()=>{window.trace.hide=window.trace.hide.filter(x=>x!==fn)}},[])};export default {};`
      : `export async function readRecommendations(c,p,cursor){window.trace.requests.push({product_id:p.product_id,cursor:cursor??null});const id=cursor?'page-b':'page-a';return {items:[{preset:{preset_id:id,version:'1.0.0',name:id,source:'OFFICIAL',author_name:'合成作者',style_tags:[]},variant_ids:['synthetic-spec'],reason:'合成推荐，仅验证首次加载'}],next_cursor:cursor?null:'page-2'}}`, resolveDir: process.cwd() }));
  } }] });
const script = result.outputFiles[0]!.text, errors: string[] = [], checks: string[] = [];
const server = createServer((request, response) => {
  response.setHeader('Cache-Control', 'no-store');
  if (request.url === '/app.js') { response.setHeader('Content-Type', 'text/javascript'); response.end(script); }
  else { response.setHeader('Content-Type', 'text/html'); response.end('<!doctype html><meta charset="UTF-8"><div id="root"></div><script src="/app.js"></script>'); }
});
await new Promise<void>((done, reject) => { server.once('error', reject); server.listen(4186, '127.0.0.1', done); });
let browserClosed = false, serverClosed = false, failure: unknown;
try {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const context = await browser.newContext();
    try {
      const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
      await page.goto('http://127.0.0.1:4186');
      await expect(page.getByText('page-a', { exact: true })).toBeVisible();
      expect(await page.evaluate(() => (window as any).trace.initial_show_sent)).toBe(true);
      expect(await page.evaluate(() => (window as any).trace.requests.length)).toBe(1);
      checks.push('LATE_MOUNT_AFTER_NATIVE_SHOW_LOADS_FIRST_PAGE_WITHOUT_ANOTHER_SHOW');
      await page.getByRole('button', { name: '加载更多', exact: true }).click(); await expect(page.getByText('page-b', { exact: true })).toBeVisible();
      expect(await page.evaluate(() => (window as any).trace.requests.length)).toBe(2); checks.push('LATE_MOUNT_PAGINATION_RETAINS_FIRST_AND_SECOND_PAGE');
      await page.evaluate(() => { for (const f of (window as any).trace.hide) f(); for (const f of (window as any).trace.show) f(); });
      await expect(page.getByText('page-a', { exact: true })).toBeVisible(); await expect(page.getByText('page-b', { exact: true })).toHaveCount(0);
      expect(await page.evaluate(() => (window as any).trace.requests.length)).toBe(3); checks.push('RETURNING_NATIVE_SHOW_REFRESHES_THE_FIRST_PAGE');
      await page.evaluate(() => (window as any).root.unmount());
    } finally { await context.close(); }
  } finally { await browser.close(); browserClosed = true; }
} catch (error) { failure = error; }
finally { await new Promise<void>(done => server.close(() => done())); serverClosed = true; }
const sourceFiles = [];
for (const path of ['scripts/check-recommendations-mount.ts', 'src/shared/ui/base.tsx', 'src/shared/ui/recommendations.tsx']) sourceFiles.push({ path, sha256: sha(await readFile(local(path))) });
const report = { checked_at: new Date().toISOString(), status: !failure && !errors.length ? 'PASS' : 'FAIL',
  source_set_hash: before.source_set_hash, source_unchanged: JSON.stringify(before) === JSON.stringify(await snapshot()),
  kind: 'ACTUAL_REACT_WITH_EMULATED_NATIVE_PAGE_SHOW_AND_SYNTHETIC_READ_ONLY_DATA', native_mini_device_verified: false,
  checks, errors, failure: failure instanceof Error ? failure.message : null, browser_tabs_closed: browserClosed, owned_server_stopped: serverClosed, source_files: sourceFiles };
await mkdir(resolve('runtime/test-results'), { recursive: true }); await mkdir(resolve('runtime/delivery'), { recursive: true });
await writeFile(local(`runtime/test-results/mini-mount-${Date.now()}.json`), JSON.stringify(report, null, 2) + '\n');
await writeFile(local('runtime/delivery/mini-mount-browser.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report)); if (report.status !== 'PASS' || !report.source_unchanged) process.exitCode = 1;
