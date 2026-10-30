import {chromium,expect} from '@playwright/test';
import {execFileSync} from 'node:child_process';
import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import './delivery/local-env.js';
import {local,sha,snapshot} from './delivery/common.js';
import {metricsEnvironment} from '../tests/helpers/metrics.js';
import {trafficClassification} from '../src/api/modules/product-insights.js';
import {transaction} from '../src/api/db/pool.js';

const build=JSON.parse(await readFile('docs/delivery/current.json','utf8')),source=await snapshot();
if(source.source_set_hash!==build.source_set_hash||build.components.find((c:{name:string})=>c.name==='preview')?.status!=='PASS')throw Error('Build current feedback and insights UI first');
process.env.YPCC_BUILD_ROOT=local(build.build_root);process.env.TEMP=process.env.TMP=local('runtime/tmp');
const attempt=local('runtime/preview-recordings/usage-insights-'+new Date().toISOString().replace(/[:.]/g,'-'));await mkdir(attempt,{recursive:true});
const env=await metricsEnvironment(),checks:string[]=[],errors:string[]=[],external:string[]=[],shots:{page:string;path:string;candidate:string}[]=[];
let browserClosed=false,appClosed=false,videoPath:string|undefined;
try{
  await transaction(env.db.pool,db=>trafficClassification(db,env.buyer.principal.tenantId,env.buyer.principal.userId,{traffic_group:'INTERNAL_TEST'}));
  env.app.get('/ops/feedback-demo',async(_request,reply)=>reply.type('text/html; charset=utf-8').send(await readFile(local(`${build.build_root}/preview/index.html`))));
  const origin=await env.app.listen({host:'127.0.0.1',port:0}),browser=await chromium.launch({channel:'msedge',headless:true});
  try{
    const context=await browser.newContext({viewport:{width:1280,height:1000},deviceScaleFactor:1,locale:'zh-CN',timezoneId:'Asia/Taipei',colorScheme:'light',recordVideo:{dir:attempt,size:{width:1280,height:1000}}});context.setDefaultTimeout(15000);
    try{
      const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
      page.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith(origin+'/'))external.push(new URL(r.url()).origin);});
      const shot=async(name:string)=>{const candidate=resolve(attempt,name+'.png');await page.screenshot({path:candidate,fullPage:true});shots.push({page:name,path:`docs/media/usage-insights/${name}.png`,candidate});};
      await page.goto(origin+'/ops/metrics',{waitUntil:'networkidle'});
      await page.getByPlaceholder('输入分配给你的运营令牌').fill(env.reader);await page.getByRole('button',{name:'连接运营看板',exact:true}).click();
      await expect(page.getByTestId('product-insights')).toBeVisible();
      const times=await page.evaluate(window=>Object.fromEntries(Object.entries(window).map(([key,value])=>{const date=new Date(value);return [key,new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16)];})),env.window);
      await page.getByLabel('开始时间',{exact:true}).fill(times.window_start!);await page.getByLabel('结束时间',{exact:true}).fill(times.window_end!);
      await page.getByRole('button',{name:'读取统计',exact:true}).click();await expect(page.getByTestId('metrics-paid')).toHaveText('5');
      await expect(page.getByTestId('product-insights')).toContainText('全部流量（包含测试）');await shot('01-all-traffic');
      await page.getByLabel('下方运营明细的流量分组').selectOption('INTERNAL_TEST');
      await expect(page.getByTestId('product-insights')).toContainText('内部测试');await expect(page.getByTestId('product-insights')).toContainText('未测量');await shot('02-test-cohort');
      await page.getByLabel('下方运营明细的流量分组').selectOption('EXTERNAL');await expect(page.getByTestId('product-insights')).toContainText('已标记外部');
      await expect(page.getByTestId('metrics-paid')).toHaveText('5');await shot('03-external-empty');
      checks.push('ACTUAL_NATIVE_HTTP_AND_POSTGRES_AGGREGATES_KEEP_ALL_TRAFFIC_SUMMARY_SEPARATE_FROM_SERVER_CLASSIFIED_DETAILS','MISSING_IMPRESSIONS_ACCURACY_AUTOMATION_AND_HUMAN_COST_STAY_UNMEASURED');
      await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await shot('04-narrow-insights');
      await page.getByRole('button',{name:'断开连接',exact:true}).click();await expect(page.getByTestId('product-insights')).toHaveCount(0);
      expect((await context.storageState()).origins).toHaveLength(0);checks.push('DISCONNECT_CLEARS_INSIGHTS_AND_NO_OPERATOR_TOKEN_IS_STORED');
      await page.goto(origin+'/ops/feedback-demo?scenario=album#/pages/pack/index?order_id=demo_order',{waitUntil:'networkidle'});
      await expect(page.getByText('这套素材，用得怎么样？',{exact:true})).toBeVisible();
      await page.getByRole('button',{name:'已经用上',exact:true}).click();await expect(page.getByRole('button',{name:'✓ 已经用上',exact:true})).toBeEnabled();
      await page.getByText('这套素材，用得怎么样？',{exact:true}).scrollIntoViewIfNeeded();await shot('05-feedback-selected');
      await page.getByRole('button',{name:'撤回使用反馈',exact:true}).click();await expect(page.getByText('尚未提供使用反馈。',{exact:true})).toBeVisible();await shot('06-feedback-withdrawn');
      await expect(page.getByRole('button',{name:'保存素材到相册',exact:true})).toBeEnabled();
      checks.push('ACTUAL_SHARED_MINI_UI_SYNTHETIC_FEEDBACK_SELECTION_AND_WITHDRAWAL_LEAVE_ALBUM_SAVE_AVAILABLE','DESKTOP_AND_390PX_LAYOUTS_HAVE_NO_HORIZONTAL_OVERFLOW');
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      const recording=page.video();await page.close();videoPath=await recording?.path();
    }finally{await context.close();}
  }finally{await browser.close();browserClosed=true;}
}finally{await env.close();appClosed=true;}
if(errors.length||external.length)throw Error(JSON.stringify({errors,external}));if(!videoPath)throw Error('Missing recording');
if(JSON.stringify(source)!==JSON.stringify(await snapshot()))throw Error('Source changed during UI recording');
const output=local('docs/media/usage-insights');await mkdir(output,{recursive:true});
for(const file of shots)await copyFile(file.candidate,local(file.path));await copyFile(videoPath,resolve(output,'walkthrough.webm'));
const ffmpeg=process.env.FFMPEG_PATH?.trim()||'ffmpeg',ffprobe=process.env.FFPROBE_PATH?.trim()||'ffprobe';
const run=(args:string[])=>execFileSync(ffmpeg,['-hide_banner','-loglevel','error','-y',...args],{windowsHide:true,timeout:60000,maxBuffer:2000000});
run(['-i',videoPath,'-an','-c:v','libx264','-crf','27','-pix_fmt','yuv420p','-movflags','+faststart',resolve(output,'walkthrough.mp4')]);
run(['-i',videoPath,'-vf','fps=3,scale=520:-2:flags=lanczos,split[a][b];[a]palettegen=max_colors=64[p];[b][p]paletteuse=dither=bayer:bayer_scale=3','-loop','0',resolve(output,'walkthrough.gif')]);
const inspection=JSON.parse(execFileSync(ffprobe,['-v','error','-show_entries','format=duration:stream=codec_name,width,height','-of','json',resolve(output,'walkthrough.mp4')],{windowsHide:true,encoding:'utf8',timeout:10000}));
const files=[];for(const path of [...shots.map(s=>s.path),...['walkthrough.webm','walkthrough.mp4','walkthrough.gif'].map(n=>'docs/media/usage-insights/'+n)]){const bytes=await readFile(local(path));files.push({path,bytes:bytes.length,sha256:sha(bytes)});}
await writeFile(resolve(output,'capture-manifest.json'),JSON.stringify({captured_at:new Date().toISOString(),type:'ACTUAL_UI_NATIVE_METRICS_AND_BROWSER_SYNTHETIC_USAGE_FEEDBACK',
  metrics_source:'ISOLATED_NATIVE_POSTGRESQL_SYNTHETIC_ORDER_AND_OPERATOR_METADATA',feedback_source:'EXPLICIT_IN_MEMORY_BROWSER_FIXTURE_NOT_BACKEND_OR_DEVICE_EVIDENCE',
  source_set_hash:source.source_set_hash,build_root:build.build_root,native_mini_device_verified:false,real_payment_verified:false,real_provider_cost_verified:false,
  production_staff_identity_verified:false,production_admitted:false,browser_tabs_closed:browserClosed,owned_api_and_database_pool_closed:appClosed,browser_errors:errors,external_network_requests:external,
  checks,screenshots:shots.map(({candidate,...item})=>item),recording:inspection,files},null,2)+'\n');
console.log(JSON.stringify({status:'PASS',checks:checks.length,screenshots:shots.length,media_files:files.length,browser_closed:browserClosed,owned_api_closed:appClosed}));
