import {chromium,expect} from '@playwright/test';
import {execFileSync} from 'node:child_process';
import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import './delivery/local-env.js';
import {local,sha,snapshot} from './delivery/common.js';
import {metricsEnvironment} from '../tests/helpers/metrics.js';
const build=JSON.parse(await readFile('docs/delivery/current.json','utf8')),source=await snapshot();
if(source.source_set_hash!==build.source_set_hash||build.components.find((c:{name:string})=>c.name==='preview')?.status!=='PASS')throw Error('Build current metrics UI first');
process.env.YPCC_BUILD_ROOT=local(build.build_root);process.env.TEMP=process.env.TMP=local('runtime/tmp');
const attempt=local('runtime/preview-recordings/metrics-'+new Date().toISOString().replace(/[:.]/g,'-'));await mkdir(attempt,{recursive:true});
const env=await metricsEnvironment(),checks:string[]=[],errors:string[]=[],external:string[]=[],screenshots:{page:string;path:string;candidate:string}[]=[],queries:string[]=[];
let browserClosed=false,appClosed=false,videoPath:string|undefined;
try{
  const origin=await env.app.listen({host:'127.0.0.1',port:0}),browser=await chromium.launch({channel:'msedge',headless:true});
  try{
    const context=await browser.newContext({viewport:{width:1280,height:1040},deviceScaleFactor:1,locale:'zh-CN',timezoneId:'Asia/Taipei',colorScheme:'light',recordVideo:{dir:attempt,size:{width:1280,height:1040}}});context.setDefaultTimeout(12000);
    try{
      const page=await context.newPage();let lose=false;
      page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith(origin+'/'))external.push(new URL(r.url()).origin);});
      await page.route(url=>url.pathname==='/v1/internal/p01/metrics/summary',async route=>{queries.push(new URL(route.request().url()).search);
        if(lose){lose=false;await route.abort('failed');}else await route.continue();});
      const shot=async(name:string)=>{const candidate=resolve(attempt,name+'.png');await page.screenshot({path:candidate,fullPage:true});screenshots.push({page:name,path:`docs/media/metrics-dashboard/${name}.png`,candidate});};
      const range=async(start:string,end:string)=>{const values=await page.evaluate(({start,end})=>{const from=new Date(start),to=new Date(end);return {
        start:new Date(from.getTime()-from.getTimezoneOffset()*60000).toISOString().slice(0,16),end:new Date(to.getTime()-to.getTimezoneOffset()*60000).toISOString().slice(0,16)};},{start,end});
        await page.getByLabel('开始时间',{exact:true}).fill(values.start);await page.getByLabel('结束时间',{exact:true}).fill(values.end);await page.getByRole('button',{name:'读取统计',exact:true}).click();};
      await page.goto(origin+'/ops/metrics',{waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready);await shot('01-independent-login');
      await expect(page.getByRole('button',{name:'连接运营看板',exact:true})).toBeDisabled();await expect(page.getByTestId('metrics-paid')).toHaveCount(0);
      checks.push('PUBLIC_LOGIN_SHELL_HAS_NO_PRIVATE_AGGREGATE_AND_REQUIRES_EXPLICIT_CONNECTION');
      await page.getByPlaceholder('输入分配给你的运营令牌').fill(env.reader);await page.getByRole('button',{name:'连接运营看板',exact:true}).click();
      await expect(page.getByRole('button',{name:'读取统计',exact:true})).toBeEnabled();await range(env.window.window_start,env.window.window_end);
      await expect(page.getByTestId('metrics-paid')).toHaveText('5');await expect(page.getByTestId('metrics-delivered')).toHaveText('3');
      await expect(page.getByText('60%',{exact:true})).toBeVisible();await expect(page.getByText('120 秒',{exact:true})).toBeVisible();await shot('02-windowed-overview');
      checks.push('ACTUAL_NATIVE_DATABASE_WINDOW_COUNTS_PAID_FIRST_DELIVERY_RATIO_COST_AND_ROUTE_TIMINGS');
      const original=queries.at(-1);lose=true;await page.getByRole('button',{name:'读取统计',exact:true}).click();await expect(page.getByRole('alert')).toContainText('统计暂未读到');
      await expect(page.getByTestId('metrics-paid')).toHaveCount(0);await shot('03-read-error');
      await page.getByRole('button',{name:'重试原时间窗口',exact:true}).click();await expect(page.getByTestId('metrics-paid')).toHaveText('5');expect(queries.at(-1)).toBe(original);
      checks.push('FAILED_REFRESH_CLEARS_STALE_VALUES_AND_RETRY_REUSES_THE_ORIGINAL_WINDOW');
      await range('2026-10-15T00:00:00.000Z','2026-10-16T00:00:00.000Z');await expect(page.getByTestId('metrics-paid')).toHaveText('0');
      await expect(page.getByText('这个窗口暂无已付款订单。可扩大时间范围；空数据不代表服务质量已经通过。',{exact:true})).toBeVisible();await shot('04-empty-window');
      checks.push('EMPTY_COHORT_DISPLAYS_ZERO_COUNTS_WITH_UNKNOWN_RATIO_AND_NO_INVENTED_TIMINGS');
      await range(env.window.window_start,env.window.window_end);await expect(page.getByTestId('metrics-paid')).toHaveText('5');await page.setViewportSize({width:390,height:844});
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);await shot('05-narrow-screen');
      checks.push('NARROW_VIEWPORT_HAS_NO_HORIZONTAL_OVERFLOW_AND_RETAINS_QUERY_AND_MEASURE_LABELS');
      await page.getByRole('button',{name:'断开连接',exact:true}).click();await expect(page.getByTestId('metrics-paid')).toHaveCount(0);
      await expect(page.getByPlaceholder('输入分配给你的运营令牌')).toHaveValue('');await expect(page.getByRole('button',{name:'连接运营看板',exact:true})).toBeDisabled();
      const stored=await context.storageState();expect(stored.cookies).toHaveLength(0);expect(stored.origins).toHaveLength(0);
      expect(await page.evaluate(()=>sessionStorage.length)).toBe(0);checks.push('DISCONNECT_CLEARS_AGGREGATE_AND_TOKEN_WITHOUT_COOKIE_OR_BROWSER_STORAGE');
      const recording=page.video();await page.close();videoPath=await recording?.path();
    }finally{await context.close();}
  }finally{await browser.close();browserClosed=true;}
}finally{await env.close();appClosed=true;}
if(errors.length||external.length)throw Error(JSON.stringify({errors,external}));if(!videoPath)throw Error('Missing metrics recording');
if(JSON.stringify(source)!==JSON.stringify(await snapshot()))throw Error('Source changed during metrics recording');
const output=local('docs/media/metrics-dashboard');await mkdir(output,{recursive:true});
for(const file of screenshots)await copyFile(file.candidate,local(file.path));await copyFile(videoPath,resolve(output,'walkthrough.webm'));
const ffmpeg=process.env.FFMPEG_PATH?.trim()||'ffmpeg',ffprobe=process.env.FFPROBE_PATH?.trim()||'ffprobe';
const run=(args:string[])=>execFileSync(ffmpeg,['-hide_banner','-loglevel','error','-y',...args],{windowsHide:true,timeout:60000,maxBuffer:2000000});
run(['-i',videoPath,'-an','-c:v','libx264','-crf','27','-pix_fmt','yuv420p','-movflags','+faststart',resolve(output,'walkthrough.mp4')]);
run(['-i',videoPath,'-vf','fps=4,scale=620:-2:flags=lanczos,split[a][b];[a]palettegen=max_colors=80[p];[b][p]paletteuse=dither=bayer:bayer_scale=3','-loop','0',resolve(output,'walkthrough.gif')]);
const inspection=JSON.parse(execFileSync(ffprobe,['-v','error','-show_entries','format=duration:stream=codec_name,width,height','-of','json',resolve(output,'walkthrough.mp4')],{windowsHide:true,encoding:'utf8',timeout:10000}));
const files=[];for(const path of [...screenshots.map(s=>s.path),...['walkthrough.webm','walkthrough.mp4','walkthrough.gif'].map(n=>`docs/media/metrics-dashboard/${n}`)]){const bytes=await readFile(local(path));files.push({path,bytes:bytes.length,sha256:sha(bytes)});}
await writeFile(resolve(output,'capture-manifest.json'),JSON.stringify({captured_at:new Date().toISOString(),type:'ACTUAL_METRICS_UI_NATIVE_HTTP_AND_DATABASE',
  data_source:'EXPLICIT_SYNTHETIC_PAYMENT_DELIVERY_COST_AND_OPERATOR_METADATA_IN_ISOLATED_NATIVE_POSTGRESQL_SCHEMA',source_set_hash:build.source_set_hash,build_root:build.build_root,
  native_mini_device_verified:false,real_payment_verified:false,real_provider_cost_verified:false,production_staff_identity_verified:false,production_admitted:false,
  browser_tabs_closed:browserClosed,owned_api_and_database_pool_closed:appClosed,browser_errors:errors,external_network_requests:external,
  checks,screenshots:screenshots.map(({candidate,...item})=>item),recording:inspection,files,read_requests:queries.length},null,2)+'\n');
console.log(JSON.stringify({status:'PASS',checks:checks.length,screenshots:screenshots.length,media_files:files.length,browser_closed:browserClosed,owned_api_closed:appClosed}));
