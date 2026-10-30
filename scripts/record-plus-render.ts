import {chromium,expect} from '@playwright/test';
import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import './delivery/local-env';
import {local,sha,snapshot} from './delivery/common';
import {plusRenderFixture} from '../tests/helpers/plus-render';
import type {DTO} from '../src/shared/contracts/types';

const before=await snapshot(),build=JSON.parse(await readFile('docs/delivery/current.json','utf8'));
if(build.source_set_hash!==before.source_set_hash||!build.selected_builds_passed)throw Error('Build this source before recording Plus production');
process.env.YPCC_BUILD_ROOT=local(build.build_root);
const output=local('docs/media/plus-render');await mkdir(output,{recursive:true});
const f=await plusRenderFixture(),origin=f.cfg.publicBaseUrl;
const screenshots:{path:string;page:string}[]=[],checks:string[]=[],errors:string[]=[],external:string[]=[];
let browserClosed=false,servicesClosed=false,videoPath:string|undefined;
try{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try{
    const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:1440,height:1000},recordVideo:{dir:local('runtime/recordings/plus-render'),size:{width:1440,height:1000}}});context.setDefaultTimeout(15000);
    try{
      await context.addInitScript(()=>document.addEventListener('DOMContentLoaded',()=>{const b=document.createElement('aside');b.textContent='本机功能演示 · 实际 PNG / 数据库 / 制作链路；身份、付款、模型与审核结论为合成数据';b.style.cssText='background:#263B32;color:#FFFAEE;padding:10px 16px;font:13px sans-serif;text-align:center';document.body.prepend(b);}));
      const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith(origin+'/'))external.push(new URL(r.url()).origin);});
      const shot=async(name:string)=>{const path=`docs/media/plus-render/${name}.png`;await page.screenshot({path:local(path)});screenshots.push({path,page:name});};
      await page.goto(origin+'/plus/',{waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready);
      await page.getByLabel('允许整理正式制作清单（每次付款仍需手机确认）').check();await page.getByRole('button',{name:'生成接续码',exact:true}).click();
      await expect(page.getByLabel('电脑接续码')).toBeVisible();await shot('01-explicit-production-scope');
      const code=(await page.getByLabel('电脑接续码').textContent())!.replace(/\s/g,'');
      const approved=await f.call('/plus/links/decision','POST',{user_code:code,decision:'APPROVE'},f.buyer.accessToken);expect(approved.statusCode,approved.body).toBe(200);expect(approved.json().data.can_prepare_render_plans).toBe(true);
      await expect(page.getByRole('button',{name:'关闭本机连接'})).toBeVisible();checks.push('EXPLICIT_NATIVE_PHONE_APPROVAL_OF_SEPARATE_PREPARE_SCOPE');
      await page.getByRole('button',{name:'查看已交付素材'}).click();await page.getByRole('button',{name:'建立图片编辑草稿'}).click();
      await expect.poll(()=>page.getByAltText('原素材裁切预览').evaluate((el:HTMLImageElement)=>el.naturalWidth)).toBe(800);
      await page.getByLabel('标题',{exact:true}).fill('蓝色随行杯');const spec=page.getByRole('group',{name:'输出规格（像素）'});
      await spec.getByLabel('宽度',{exact:true}).fill('1080');await spec.getByLabel('高度',{exact:true}).fill('1440');
      await expect(page.getByRole('button',{name:'整理独立制作清单'})).toBeDisabled();checks.push('UNSAVED_EDITS_CANNOT_ENTER_COMMERCIAL_PLAN');
      await page.getByRole('button',{name:'保存独立编辑草稿'}).click();await expect(page.getByText('编辑草稿已保存为版本 2',{exact:true})).toBeVisible();
      await page.getByLabel('制作风格').selectOption('minimal-clean.photo-layout');await expect(page.getByRole('button',{name:'整理独立制作清单'})).toBeEnabled();await shot('02-edited-size-and-separate-price');
      await page.getByRole('button',{name:'整理独立制作清单'}).click();await expect(page.getByText('正在整理本版内容与规格',{exact:true})).toBeVisible();
      await f.step('PLAN');await expect(page.getByText('清单已就绪，请回手机确认费用',{exact:true})).toBeVisible();await shot('03-native-payment-handoff');checks.push('PERSISTED_CONTENT_ROLE_AND_FROZEN_PRICE_HANDOFF');
      const list=(await f.call('/plus/render-plans','GET',undefined,f.buyer.accessToken)).json().data.items as DTO<'PlusRenderPlan'>[],request=list[0]!;
      const quoted=await f.call('/quotes','POST',{plan_id:request.plan.plan_id,plan_hash:request.plan.plan_hash},f.buyer.accessToken);expect(quoted.statusCode,quoted.body).toBe(201);expect(quoted.json().data.amount_fen).toBe(200);
      const created=await f.call('/orders','POST',{quote_id:quoted.json().data.quote_id,channel:'alipay'},f.buyer.accessToken);expect(created.statusCode,created.body).toBe(201);const order=created.json().data as DTO<'Order'>;
      expect(order.fulfillment_state).toBe('NOT_STARTED');await f.pay(order);checks.push('DISTINCT_NATIVE_QUOTE_ORDER_AND_SYNTHETIC_PAYMENT_BEFORE_WORK');
      for(const name of ['PRODUCTION','POST','QC','REVIEW_FACTS','REVIEW_STYLE','DELIVER'] as const)await f.step(name);
      await expect(page.getByText('新成品已交付',{exact:true})).toBeVisible();await shot('04-reviewed-production-complete');
      await page.getByRole('button',{name:'打开新成品素材包'}).click();await expect(page.getByRole('button',{name:'建立图片编辑草稿'})).toBeVisible();await shot('05-new-private-image-and-copy');
      const pack=(await f.call(`/orders/${order.order_id}/deliverables`,'GET',undefined,f.buyer.accessToken)).json().data as DTO<'Deliverables'>;
      expect(pack.items.map(i=>i.kind).sort()).toEqual(['copy','image']);const item=pack.items.find(i=>i.kind==='image')!;
      const artifact=(await f.db.pool.query('SELECT object_key FROM artifacts WHERE id=$1',[item.deliverable_id])).rows[0];await writeFile(resolve(output,'06-actual-edited-image.png'),await f.store.get(artifact.object_key));
      screenshots.push({path:'docs/media/plus-render/06-actual-edited-image.png',page:'ACTUAL_NEW_PNG_OUTPUT_NOT_A_SCREENSHOT'});checks.push('ACTUAL_NEW_PNG_AND_COPY_AFTER_PRODUCTION_POST_QC_AND_TWO_REVIEWS');
      expect((await f.call(`/orders/${f.originalId}/deliverables`,'GET',undefined,f.buyer.accessToken)).json().data.manifest_id).toBe(f.pack.manifest_id);checks.push('ORIGINAL_PACK_PRESERVED');
      const video=page.video();await page.close();videoPath=await video?.path();
    }finally{await context.close();}
  }finally{await browser.close();browserClosed=true;}
}finally{await f.close();servicesClosed=true;}
if(errors.length||external.length)throw Error(JSON.stringify({browser_errors:errors,external_origins:external}));if(!videoPath)throw Error('Missing owned browser recording');
await copyFile(videoPath,resolve(output,'walkthrough.webm'));
const ffmpeg=process.env.FFMPEG_PATH?.trim()||'ffmpeg',run=(args:string[])=>execFileSync(ffmpeg,['-hide_banner','-loglevel','error','-y',...args],{windowsHide:true,timeout:30000,maxBuffer:2000000});
run(['-i',videoPath,'-an','-c:v','libx264','-pix_fmt','yuv420p','-movflags','+faststart',resolve(output,'walkthrough.mp4')]);
run(['-i',videoPath,'-vf','fps=8,scale=760:-1:flags=lanczos','-loop','0',resolve(output,'walkthrough.gif')]);
const inspection=JSON.parse(execFileSync(process.env.FFPROBE_PATH?.trim()||'ffprobe',['-v','error','-show_entries','format=duration','-of','json',resolve(output,'walkthrough.mp4')],{windowsHide:true,encoding:'utf8',timeout:10000}));
const files=[];for(const name of [...screenshots.map(s=>s.path.split('/').at(-1)!), 'walkthrough.mp4','walkthrough.webm','walkthrough.gif']){const path=`docs/media/plus-render/${name}`,bytes=await readFile(local(path));files.push({path,bytes:bytes.length,sha256:sha(bytes)});}
if(JSON.stringify(before)!==JSON.stringify(await snapshot()))throw Error('Source changed during recording');
await writeFile(resolve(output,'capture-manifest.json'),JSON.stringify({captured_at:new Date().toISOString(),status:'PASS',source_set_hash:before.source_set_hash,build_root:build.build_root,
  data_source:'ACTUAL_HTTPS_POSTGRESQL_MCP_PNG_CONTENT_PRODUCTION_POST_QC_TWO_REVIEWS_AND_DELIVERY;SYNTHETIC_IDENTITY_PAYMENT_MODEL_VERDICTS_AND_PROCESS_IDENTITY',
  checks,screenshots,files,recording:inspection,browser_errors:errors,external_network_requests:external,browser_tabs_closed:browserClosed,owned_api_and_database_pool_closed:servicesClosed,
  real_service_or_payment_verified:false,native_mini_device_verified:false,full_product_verified:false},null,2)+'\n');
console.log(JSON.stringify({status:'PASS',checks:checks.length,media_files:files.length,browser_closed:browserClosed,services_closed:servicesClosed}));
