import {chromium,expect} from '@playwright/test';
import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import './delivery/local-env';
import {local,sha,snapshot} from './delivery/common';
import {plusVideoFixture} from '../tests/helpers/plus-video';
import type {DTO} from '../src/shared/contracts/types';

const before=await snapshot(),build=JSON.parse(await readFile('docs/delivery/current.json','utf8'));
if(build.source_set_hash!==before.source_set_hash||!build.builds_passed)throw Error('Build the current source before recording video editing');
process.env.YPCC_BUILD_ROOT=local(build.build_root);
const output=local('docs/media/plus-video');await mkdir(output,{recursive:true});
const f=await plusVideoFixture(),origin=f.cfg.publicBaseUrl;
const screenshots:{path:string;page:string}[]=[],checks:string[]=[],errors:string[]=[],external:string[]=[];
let browserClosed=false,servicesClosed=false,videoPath:string|undefined;
try{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try{
    const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:1440,height:1050},recordVideo:{dir:local('runtime/recordings/plus-video'),size:{width:1440,height:1050}}});context.setDefaultTimeout(20000);
    try{
      await context.addInitScript(()=>document.addEventListener('DOMContentLoaded',()=>{const banner=document.createElement('aside');banner.textContent='本机视频剪辑演示 · 实际MP4 / 数据库 / 制作链路；身份、付款、Agent与听音判定为合成，音频为提示音';banner.style.cssText='background:#263B32;color:#FFFAEE;padding:10px 16px;font:13px sans-serif;text-align:center';document.body.prepend(banner);}));
      const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith(origin+'/'))external.push(new URL(r.url()).origin);});
      const shot=async(name:string)=>{const path=`docs/media/plus-video/${name}.png`;await page.screenshot({path:local(path),fullPage:true});screenshots.push({path,page:name});};
      await page.goto(origin+'/plus/',{waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready);
      await page.getByLabel('允许整理原片视频剪辑清单（独立计价，付款仍需手机确认）').check();await shot('01-explicit-video-permission');
      await page.getByRole('button',{name:'生成接续码',exact:true}).click();await expect(page.getByLabel('电脑接续码')).toBeVisible();
      const code=(await page.getByLabel('电脑接续码').textContent())!.replace(/\s/g,'');
      const approved=await f.call('/plus/links/decision','POST',{user_code:code,decision:'APPROVE'},f.buyer.accessToken);expect(approved.statusCode,approved.body).toBe(200);
      await expect(page.getByRole('button',{name:'关闭本机连接'})).toBeVisible();checks.push('SEPARATE_VIDEO_PERMISSION_APPROVED_BY_NATIVE_ACCOUNT');
      await page.getByRole('button',{name:/查看已交付素材/}).first().click();await page.getByRole('button',{name:'建立视频剪辑草稿',exact:true}).click();
      await expect(page.getByLabel('原视频选段预览')).toBeVisible();await page.getByLabel('选段开始秒数').fill('1');await page.getByLabel('选段结束秒数').fill('3');
      const dimensions=page.getByRole('group',{name:'输出尺寸（偶数像素）'});await dimensions.getByLabel('宽度',{exact:true}).fill('640');await dimensions.getByLabel('高度',{exact:true}).fill('960');
      await page.getByLabel('视频标题').fill('蓝色随行杯');await page.getByRole('button',{name:'添加定时字幕',exact:true}).click();await page.getByLabel('字幕1文字').fill('蓝色杯身');
      await page.getByLabel('预览原片位置').focus();await page.getByLabel('预览原片位置').press('ArrowRight');await page.evaluate(()=>window.scrollTo(0,0));await shot('02-trim-and-timed-caption');
      await page.getByRole('button',{name:'保存视频剪辑草稿',exact:true}).click();await expect(page.getByText('视频草稿已保存为版本 2',{exact:true})).toBeVisible();
      await page.getByLabel('制作风格').selectOption('minimal-clean.photo-layout');await page.getByRole('button',{name:'整理独立制作清单',exact:true}).click();
      await expect(page.getByText('正在整理本版内容与规格',{exact:true})).toBeVisible();await f.step('PLAN');
      await expect(page.getByText('清单已就绪，请回手机确认费用',{exact:true})).toBeVisible();await shot('03-independent-phone-checkout');checks.push('SAVED_EXACT_TRIM_TIMED_COPY_AND_FROZEN_INDEPENDENT_VIDEO_PLAN');
      const requests=(await f.call('/plus/video-render-plans','GET',undefined,f.buyer.accessToken)).json().data.items as DTO<'PlusVideoRenderPlan'>[],request=requests[0]!;
      const quoted=await f.call('/quotes','POST',{plan_id:request.plan.plan_id,plan_hash:request.plan.plan_hash},f.buyer.accessToken);expect(quoted.statusCode,quoted.body).toBe(201);expect(quoted.json().data.amount_fen).toBe(300);
      const created=await f.call('/orders','POST',{quote_id:quoted.json().data.quote_id,channel:'alipay'},f.buyer.accessToken);expect(created.statusCode,created.body).toBe(201);const order=created.json().data as DTO<'Order'>;
      await f.pay(order);for(const name of ['PRODUCTION','POST','QC','REVIEW_FACTS','REVIEW_STYLE','DELIVER'] as const)await f.step(name);
      expect(f.listenCount()).toBe(1);await expect(page.getByText('新成品已交付',{exact:true})).toBeVisible();await shot('04-reviewed-video-complete');
      checks.push('ACTUAL_MP4_POST_QC_TWO_COMPLETE_AUDIO_TRACKS_AND_TWO_REVIEW_INPUTS');
      await page.getByRole('button',{name:'打开新成品素材包',exact:true}).click();await expect(page.getByRole('button',{name:'建立视频剪辑草稿',exact:true})).toBeVisible();await shot('05-private-video-cover-and-copy');
      const pack=(await f.call(`/orders/${order.order_id}/deliverables`,'GET',undefined,f.buyer.accessToken)).json().data as DTO<'Deliverables'>;
      expect(pack.items.map(i=>i.kind).sort()).toEqual(['copy','image','video']);
      for(const [kind,name] of [['video','edited-sample.mp4'],['image','actual-first-frame-cover.png']] as const){const item=pack.items.find(i=>i.kind===kind)!;
        const artifact=(await f.db.pool.query('SELECT object_key FROM artifacts WHERE id=$1',[item.deliverable_id])).rows[0];await writeFile(resolve(output,name),await f.store.get(artifact.object_key));}
      expect((await f.call(`/orders/${f.originalId}/deliverables`,'GET',undefined,f.buyer.accessToken)).json().data.manifest_id).toBe(f.pack.manifest_id);checks.push('NEW_PRIVATE_VIDEO_COVER_COPY_AND_ORIGINAL_PACK_PRESERVED');
      const recording=page.video();await page.close();videoPath=await recording?.path();
    }finally{await context.close();}
  }finally{await browser.close();browserClosed=true;}
}finally{await f.close();servicesClosed=true;}
if(errors.length||external.length)throw Error(JSON.stringify({browser_errors:errors,external_origins:external}));if(!videoPath)throw Error('Missing owned browser recording');
await copyFile(videoPath,resolve(output,'walkthrough.webm'));
const ffmpeg=process.env.FFMPEG_PATH?.trim()||'ffmpeg';
execFileSync(ffmpeg,['-y','-hide_banner','-loglevel','error','-i',resolve(output,'walkthrough.webm'),'-an','-c:v','libx264','-threads','2','-pix_fmt','yuv420p','-movflags','+faststart',resolve(output,'walkthrough.mp4')],{windowsHide:true});
execFileSync(ffmpeg,['-y','-hide_banner','-loglevel','error','-i',resolve(output,'walkthrough.webm'),'-an','-vf','fps=5,scale=800:-2:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse','-threads','2','-loop','0',resolve(output,'walkthrough.gif')],{windowsHide:true});
const after=await snapshot();if(before.source_set_hash!==after.source_set_hash)throw Error('Source changed while recording');
const files=await Promise.all([...screenshots.map(s=>s.path),...['edited-sample.mp4','actual-first-frame-cover.png','walkthrough.webm','walkthrough.mp4','walkthrough.gif'].map(n=>'docs/media/plus-video/'+n)].map(async path=>{const bytes=await readFile(local(path));return {path,sha256:sha(bytes),bytes:bytes.length};}));
await writeFile(local('docs/verification/plus-video-browser.json'),JSON.stringify({checked_at:new Date().toISOString(),source_set_hash:before.source_set_hash,
  build_id:build.id,checks,files,browser_errors:errors,external_origins:external,browser_closed:browserClosed,services_closed:servicesClosed,
  actual_native_pg_https_mcp_ffmpeg:true,synthetic_identity_payment_inference_listening_and_isolation:true,full_suite_executed:false,
  full_product_verified:false,production_admitted:false,cloud_deployed:false},null,2)+'\n');
console.log(JSON.stringify({checks:checks.length,files:files.length,browserClosed,servicesClosed,evidence:'docs/verification/plus-video-browser.json'}));
