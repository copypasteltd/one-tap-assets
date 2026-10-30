import {chromium,expect} from '@playwright/test';
import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import './delivery/local-env.js';
import {local,sha,snapshot} from './delivery/common.js';
import {plusFixture} from '../tests/helpers/plus.js';

const before=await snapshot(),build=JSON.parse(await readFile('docs/delivery/current.json','utf8'));
if(build.source_set_hash!==before.source_set_hash||!build.selected_builds_passed)throw Error('Build this source before recording Plus');
process.env.YPCC_BUILD_ROOT=local(build.build_root);
const output=local('docs/media/plus-workspace');await mkdir(output,{recursive:true});
const origin='https://127.0.0.1:4180',f=await plusFixture({publicBaseUrl:origin,webOrigins:[origin]});
const screenshots:{path:string;page:string}[]=[],checks:string[]=[],errors:string[]=[],external:string[]=[];
let browserClosed=false,servicesClosed=false,videoPath:string|undefined;
try{
  if(!f.cfg.tlsCert||!f.cfg.tlsKey)throw Error('Configure the existing project-local development TLS certificate before the actual HTTPS capture');
  // This route is only a recording fixture. Its shared mini-program UI uses
  // synthetic replies; the Plus browser uses real native HTTP/PG below.
  const html=await readFile(local(build.build_root+'/preview/index.html'),'utf8');
  f.app.get('/mini-replay/',async(_req,reply)=>reply.type('text/html').send(html.replaceAll('./assets/','/ops/assets/')));
  await f.app.listen({host:'127.0.0.1',port:4180});
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try{
    const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:1280,height:1000},locale:'zh-CN',deviceScaleFactor:1,recordVideo:{dir:local('runtime/preview-recordings/plus-workspace'),size:{width:1280,height:1000}}});
    context.setDefaultTimeout(10000);
    try{
      await context.addInitScript(()=>document.addEventListener('DOMContentLoaded',()=>{const banner=document.createElement('aside');banner.textContent='本机演示 / Local capture · 身份、付款及验收为合成夹具 / Synthetic identity, payment and QC';banner.style.cssText='background:#263B32;color:#FFFAEE;padding:9px 16px;font:12px sans-serif;text-align:center';document.body.prepend(banner);}));
      const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith(origin+'/'))external.push(new URL(r.url()).origin);});
      await page.goto(origin+'/plus/',{waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready);
      const shot=async(p:typeof page,name:string)=>{const path=`docs/media/plus-workspace/${name}.png`;await p.screenshot({path:local(path)});screenshots.push({path,page:name});};
      await page.getByRole('button',{name:'生成接续码',exact:true}).click();await expect(page.getByLabel('电脑接续码')).toBeVisible();await shot(page,'01-browser-approval-code');
      const code=(await page.getByLabel('电脑接续码').textContent())!.replace(/\s/g,'');
      const inspect=await context.request.post(origin+'/v1/p01/plus/links/inspect',{headers:{authorization:`Bearer ${f.buyer.accessToken}`},data:{user_code:code}});expect(inspect.status()).toBe(200);
      const decision=await context.request.post(origin+'/v1/p01/plus/links/decision',{headers:{authorization:`Bearer ${f.buyer.accessToken}`},data:{user_code:code,decision:'APPROVE'}});expect(decision.status()).toBe(200);
      await expect(page.getByRole('button',{name:'关闭本机连接'})).toBeVisible();checks.push('ACTUAL_HTTPS_NATIVE_APPROVAL_AND_HASHED_POLL_CLAIM_CONNECT_BROWSER');
      await page.getByRole('button',{name:'查看已交付素材'}).click();await expect(page.getByRole('button',{name:'建立图片编辑草稿'})).toBeVisible();await shot(page,'02-owned-delivery');checks.push('OWNER_SCOPED_PAID_PACK_LOADED_FROM_NATIVE_DATABASE');
      await page.getByRole('button',{name:'建立图片编辑草稿'}).click();await expect(page.getByAltText('原素材裁切预览')).toBeVisible();
      await expect.poll(()=>page.getByAltText('原素材裁切预览').evaluate((el:HTMLImageElement)=>el.naturalWidth)).toBe(640);checks.push('ACTUAL_SIGNED_PRIVATE_PNG_BYTES_RENDERED');
      await page.getByLabel('标题',{exact:true}).fill('把日常，拍成好心情');await page.getByLabel('品牌（可选）',{exact:true}).fill('演示品牌');
      await page.getByLabel('补充事实（每行一条，最多8条）').fill('仅作为待核对演示文字');
      await page.getByLabel('左边距',{exact:true}).fill('10');await page.getByLabel('宽度',{exact:true}).first().fill('80');
      const spec=page.getByRole('group',{name:'输出规格（像素）'});await spec.getByLabel('宽度',{exact:true}).fill('1080');await spec.getByLabel('高度',{exact:true}).fill('1440');
      await page.getByRole('button',{name:'保存独立编辑草稿'}).click();await expect(page.getByText('编辑草稿已保存为版本 2',{exact:true})).toBeVisible();await shot(page,'03-versioned-edit-draft');
      const saved=(await f.db.pool.query('SELECT data FROM plus_edit_drafts WHERE owner_id=$1',[f.buyer.principal.userId])).rows[0].data;
      expect(saved).toMatchObject({revision:2,state:'DRAFT',fact_status:'USER_PROVIDED_UNVERIFIED',settings:{canvas:{width:1080,height:1440},crop:{x:.1,width:.8}}});checks.push('NATIVE_PERSISTED_CROP_SPEC_TEXT_AND_UNVERIFIED_FACTS_IN_SEPARATE_REVISION');
      await page.getByRole('button',{name:'重新读取已保存草稿'}).click();await expect(page.getByLabel('标题',{exact:true})).toHaveValue('把日常，拍成好心情');checks.push('SAVED_DRAFT_RECOVERS_FROM_NATIVE_API');
      expect(await page.evaluate(()=>localStorage.length===0&&sessionStorage.length===0)).toBe(true);expect(await context.cookies()).toHaveLength(0);checks.push('NO_BROWSER_STORAGE_OR_COOKIE_CONTAINS_AUTHORIZATION');
      const mobile=await context.newPage();await mobile.setViewportSize({width:430,height:932});mobile.on('pageerror',e=>errors.push(e.message));mobile.on('dialog',dialog=>void dialog.accept());
      await mobile.goto(origin+'/mini-replay/#/pages/settings/index',{waitUntil:'networkidle'});await mobile.getByRole('button',{name:'接续到电脑 Plus',exact:true}).click();await mobile.getByPlaceholder('8位接续码').fill('ABCD2345');
      await mobile.getByRole('button',{name:'查看接续请求'}).click();await mobile.getByRole('button',{name:'允许这台电脑连接'}).click();await expect(mobile.getByRole('button',{name:'关闭这个电脑连接'})).toBeVisible();await shot(mobile,'04-shared-mini-explicit-approval');
      await mobile.getByRole('button',{name:'关闭这个电脑连接'}).click();await expect(mobile.getByText('目前没有有效电脑连接。确认后，可在电脑继续你的素材。',{exact:true})).toBeVisible();await shot(mobile,'05-shared-mini-revoke');checks.push('SHARED_MINI_APPROVAL_AND_REVOCATION_UI_WITH_EXPLICIT_SYNTHETIC_REPLIES');await mobile.close();
      const sessions=await context.request.get(origin+'/v1/p01/plus/sessions',{headers:{authorization:`Bearer ${f.buyer.accessToken}`}});expect(sessions.status()).toBe(200);
      const active=(await sessions.json()).data.items[0];expect(active).toBeTruthy();
      const revoke=await context.request.delete(origin+'/v1/p01/plus/sessions/'+active.session_id,{headers:{authorization:`Bearer ${f.buyer.accessToken}`}});expect(revoke.status()).toBe(200);
      await page.getByRole('button',{name:'刷新',exact:true}).click();await expect(page.getByRole('alert')).toContainText('电脑连接已关闭或到期，请重新接续');await expect(page.getByLabel('标题',{exact:true})).toHaveCount(0);await shot(page,'06-revoked-browser-cleared');checks.push('NATIVE_REVOCATION_DENIES_FUTURE_REQUESTS_AND_CLEARS_PRIVATE_BROWSER_VIEW');
      await page.setViewportSize({width:320,height:800});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);checks.push('NO_HORIZONTAL_OVERFLOW_AT_320PX');
      const video=page.video();await page.close();videoPath=await video?.path();
    }finally{await context.close();}
  }finally{await browser.close();browserClosed=true;}
}finally{await f.close();servicesClosed=true;}
if(errors.length||external.length)throw Error(JSON.stringify({browser_errors:errors,external_origins:external}));
if(!videoPath)throw Error('Missing Plus browser recording');
await copyFile(videoPath,resolve(output,'walkthrough.webm'));
const ffmpeg=process.env.FFMPEG_PATH?.trim()||'ffmpeg',ffprobe=process.env.FFPROBE_PATH?.trim()||'ffprobe';
const run=(args:string[])=>execFileSync(ffmpeg,['-hide_banner','-loglevel','error','-y',...args],{windowsHide:true,timeout:30000,maxBuffer:2000000});
run(['-i',videoPath,'-an','-c:v','libx264','-pix_fmt','yuv420p','-movflags','+faststart',resolve(output,'walkthrough.mp4')]);
run(['-i',videoPath,'-vf','fps=8,scale=760:-1:flags=lanczos','-loop','0',resolve(output,'walkthrough.gif')]);
const inspection=JSON.parse(execFileSync(ffprobe,['-v','error','-show_entries','format=duration','-of','json',resolve(output,'walkthrough.mp4')],{windowsHide:true,encoding:'utf8',timeout:10000}));
const files=[];for(const name of [...screenshots.map(s=>s.path.split('/').at(-1)!), 'walkthrough.mp4','walkthrough.webm','walkthrough.gif']){const path=`docs/media/plus-workspace/${name}`,bytes=await readFile(local(path));files.push({path,bytes:bytes.length,sha256:sha(bytes)});}
if(JSON.stringify(before)!==JSON.stringify(await snapshot()))throw Error('Source changed during recording');
await writeFile(resolve(output,'capture-manifest.json'),JSON.stringify({captured_at:new Date().toISOString(),status:'PASS',source_set_hash:before.source_set_hash,build_root:build.build_root,
  data_source:'ACTUAL_HTTPS_POSTGRESQL_AND_PRIVATE_PNG_PLUS_WEB_UI_WITH_SYNTHETIC_IDENTITY_PAYMENT_QA_METADATA;SHARED_MINI_REPLAY_USES_SYNTHETIC_RESPONSES',
  checks,screenshots,files,recording:inspection,browser_errors:errors,external_network_requests:external,browser_tabs_closed:browserClosed,owned_api_and_database_pool_closed:servicesClosed,
  real_service_or_payment_verified:false,native_mini_device_verified:false,full_product_verified:false},null,2)+'\n');
console.log(JSON.stringify({status:'PASS',checks:checks.length,screenshots:screenshots.length,media_files:files.length,browser_closed:browserClosed,services_closed:servicesClosed}));
