import {chromium,expect} from '@playwright/test';
import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import './delivery/local-env';
import {local,sha,snapshot} from './delivery/common';
import {plusBatchFixture} from '../tests/helpers/plus-batches';
import type {DTO} from '../src/shared/contracts/types';

const before=await snapshot(),build=JSON.parse(await readFile('docs/delivery/current.json','utf8'));
if(build.source_set_hash!==before.source_set_hash||!build.selected_builds_passed)throw Error('Build this source before recording batch production');
process.env.YPCC_BUILD_ROOT=local(build.build_root);
const output=local('docs/media/plus-batches');await mkdir(output,{recursive:true});
const f=await plusBatchFixture(),origin=f.cfg.publicBaseUrl;
const screenshots:{path:string;page:string}[]=[],checks:string[]=[],errors:string[]=[],external:string[]=[];
let browserClosed=false,servicesClosed=false,videoPath:string|undefined;
try{
  const seed=await f.connect(true),drafts:DTO<'PlusEditDraft'>[]=[];
  for(const [index,parent] of f.parents.entries()){
    const created=await f.call('/plus/edit-drafts','POST',{order_id:parent.orderId,deliverable_id:parent.artifactId},seed.access_token);expect(created.statusCode,created.body).toBe(200);const draft=created.json().data as DTO<'PlusEditDraft'>;
    const saved=await f.call(`/plus/edit-drafts/${draft.draft_id}`,'PUT',{expected_revision:1,settings:{...draft.settings,title:['蓝色随行杯','暖橙收纳罐','浅绿整理盒'][index],canvas:{width:1080,height:1440}}},seed.access_token);expect(saved.statusCode,saved.body).toBe(200);drafts.push(saved.json().data);
  }
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try{
    const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:1440,height:1050},recordVideo:{dir:local('runtime/recordings/plus-batches'),size:{width:1440,height:1050}}});context.setDefaultTimeout(20000);
    try{
      await context.addInitScript(()=>document.addEventListener('DOMContentLoaded',()=>{const banner=document.createElement('aside');banner.textContent='本机批量流程演示 · 实际 PNG / 数据库 / 制作链路；身份、付款、模型与审核结论为合成数据';banner.style.cssText='background:#263B32;color:#FFFAEE;padding:10px 16px;font:13px sans-serif;text-align:center';document.body.prepend(banner);}));
      const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith(origin+'/'))external.push(new URL(r.url()).origin);});
      const shot=async(name:string)=>{const path=`docs/media/plus-batches/${name}.png`;await page.screenshot({path:local(path)});screenshots.push({path,page:name});};
      await page.goto(origin+'/plus/',{waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready);
      await page.getByLabel('允许整理正式制作清单（每次付款仍需手机确认）').check();await page.getByRole('button',{name:'生成接续码',exact:true}).click();
      await expect(page.getByLabel('电脑接续码')).toBeVisible();const code=(await page.getByLabel('电脑接续码').textContent())!.replace(/\s/g,'');
      const approved=await f.call('/plus/links/decision','POST',{user_code:code,decision:'APPROVE'},f.buyer.accessToken);expect(approved.statusCode,approved.body).toBe(200);
      await expect(page.getByRole('button',{name:'关闭本机连接'})).toBeVisible();checks.push('EXPLICIT_NATIVE_APPROVAL_OF_BROWSER_PREPARATION_SCOPE');
      await page.getByRole('button',{name:'批量制作',exact:true}).click();await page.getByLabel('批次默认风格').selectOption('minimal-clean.photo-layout@3.1.0');
      await expect(page.getByAltText('这份草稿的原素材')).toHaveCount(3);checks.push('ACTUAL_PRIVATE_PRODUCT_THUMBNAILS_IN_LAZY_BOUNDED_WORKSPACE');
      for(const name of ['蓝色随行杯','暖橙收纳罐','浅绿整理盒'])await page.getByLabel('选择'+name,{exact:true}).check();
      await expect(page.getByRole('button',{name:'整理这批独立制作清单'})).toBeEnabled();await shot('01-select-three-products');
      const stale=drafts[2]!;const changed=await f.call(`/plus/edit-drafts/${stale.draft_id}`,'PUT',{expected_revision:stale.revision,settings:{...stale.settings,title:'另一窗口已保存新版'}},seed.access_token);expect(changed.statusCode,changed.body).toBe(200);
      await page.getByRole('button',{name:'整理这批独立制作清单'}).click();const results=page.getByRole('region',{name:'当前批次'});
      await expect(results.getByText('这件暂未建立清单',{exact:true})).toBeVisible();await expect(results.getByText('正在整理内容与规格',{exact:true})).toHaveCount(2);await results.scrollIntoViewIfNeeded();await shot('02-stale-item-isolated');checks.push('FROZEN_CLIENT_REVISION_AND_PER_ITEM_SAVEPOINT_FAILURE');
      await f.step('PLAN');await f.step('PLAN');await page.getByRole('button',{name:'刷新本批次',exact:true}).click();await expect(results.getByText('清单已就绪，待手机确认费用',{exact:true})).toHaveCount(2);await shot('03-separate-native-confirmation');checks.push('TWO_INDEPENDENT_CONTENT_PLANS_READY_FOR_NATIVE_CONFIRMATION');
      const batches=await f.call('/plus/render-batches','GET',undefined,f.buyer.accessToken);expect(batches.statusCode,batches.body).toBe(200);const batchId=batches.json().data.items[0].batch_id as string;
      const current=await f.call(`/plus/render-batches/${batchId}`,'GET',undefined,f.buyer.accessToken);expect(current.statusCode,current.body).toBe(200);const batch=current.json().data as DTO<'PlusBatch'>,orders:DTO<'Order'>[]=[];
      for(const item of batch.items.filter(i=>i.render)){
        const render=item.render!,quote=await f.call('/quotes','POST',{plan_id:render.plan.plan_id,plan_hash:render.plan.plan_hash},f.buyer.accessToken);expect(quote.statusCode,quote.body).toBe(201);expect(quote.json().data.amount_fen).toBe(200);
        const created=await f.call('/orders','POST',{quote_id:quote.json().data.quote_id,channel:'alipay'},f.buyer.accessToken);expect(created.statusCode,created.body).toBe(201);orders.push(created.json().data);
      }
      expect(orders[0]!.order_id).not.toBe(orders[1]!.order_id);await f.pay(orders[0]!);checks.push('TWO_DISTINCT_NATIVE_QUOTES_AND_ORDERS_ONLY_FIRST_SYNTHETICALLY_PAID');
      for(const name of ['PRODUCTION','POST','QC','REVIEW_FACTS','REVIEW_STYLE','DELIVER'] as const)await f.step(name);
      await page.getByRole('button',{name:'刷新本批次',exact:true}).click();await expect(results.getByText('新成品已交付',{exact:true})).toBeVisible();await expect(results.getByText('已建立订单，待手机主动付款',{exact:true})).toBeVisible();await results.scrollIntoViewIfNeeded();await shot('04-first-delivered-second-unpaid');
      expect((await f.db.pool.query("SELECT id FROM agent_instances WHERE state='ACTIVE'")).rowCount).toBe(0);checks.push('FIRST_PRODUCT_DELIVERED_AFTER_QC_TWO_REVIEWS_AND_ALL_ROLE_RELEASES');checks.push('UNPAID_SIBLING_AND_FAILED_PRODUCT_DO_NOT_BLOCK_DELIVERY');
      await page.getByRole('button',{name:'打开这件的新成品',exact:true}).click();await expect(page.getByRole('button',{name:'建立图片编辑草稿'})).toBeVisible();await shot('05-open-independent-private-pack');
      const delivered=await f.call(`/orders/${orders[0]!.order_id}/deliverables`,'GET',undefined,f.buyer.accessToken);expect(delivered.statusCode,delivered.body).toBe(200);const pack=delivered.json().data as DTO<'Deliverables'>;
      expect(pack.items.map(i=>i.kind).sort()).toEqual(['copy','image']);const image=pack.items.find(i=>i.kind==='image')!,artifact=(await f.db.pool.query('SELECT object_key FROM artifacts WHERE id=$1',[image.deliverable_id])).rows[0];await writeFile(resolve(output,'06-actual-batch-product.png'),await f.store.get(artifact.object_key));screenshots.push({path:'docs/media/plus-batches/06-actual-batch-product.png',page:'ACTUAL_PAID_BATCH_ITEM_PNG_NOT_A_SCREENSHOT'});
      for(const parent of f.parents){const original=await f.call(`/orders/${parent.orderId}/deliverables`,'GET',undefined,f.buyer.accessToken);expect(original.statusCode,original.body).toBe(200);expect(original.json().data.manifest_id).toBe(parent.pack.manifest_id);}checks.push('ALL_THREE_ORIGINAL_PACKS_PRESERVED');
      await page.getByRole('button',{name:'关闭本机连接',exact:true}).click();await expect(page.getByRole('button',{name:'生成接续码',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'批量制作',exact:true})).toHaveCount(0);checks.push('BROWSER_DISCONNECT_CLEARS_PRIVATE_BATCH_WORKSPACE');
      const video=page.video();await page.close();videoPath=await video?.path();
    }finally{await context.close();}
  }finally{await browser.close();browserClosed=true;}
}finally{await f.close();servicesClosed=true;}
if(errors.length||external.length)throw Error(JSON.stringify({browser_errors:errors,external_origins:external}));if(!videoPath)throw Error('Missing owned recording');
await copyFile(videoPath,resolve(output,'walkthrough.webm'));
const ffmpeg=process.env.FFMPEG_PATH?.trim()||'ffmpeg',run=(args:string[])=>execFileSync(ffmpeg,['-hide_banner','-loglevel','error','-y',...args],{windowsHide:true,timeout:30000,maxBuffer:2000000});
run(['-i',videoPath,'-an','-c:v','libx264','-pix_fmt','yuv420p','-movflags','+faststart',resolve(output,'walkthrough.mp4')]);run(['-i',videoPath,'-vf','fps=8,scale=760:-1:flags=lanczos','-loop','0',resolve(output,'walkthrough.gif')]);
const inspection=JSON.parse(execFileSync(process.env.FFPROBE_PATH?.trim()||'ffprobe',['-v','error','-show_entries','format=duration','-of','json',resolve(output,'walkthrough.mp4')],{windowsHide:true,encoding:'utf8',timeout:10000}));
const files=[];for(const name of [...screenshots.map(s=>s.path.split('/').at(-1)!),'walkthrough.mp4','walkthrough.webm','walkthrough.gif']){const path=`docs/media/plus-batches/${name}`,bytes=await readFile(local(path));files.push({path,bytes:bytes.length,sha256:sha(bytes)});}
if(JSON.stringify(before)!==JSON.stringify(await snapshot()))throw Error('Source changed during recording');
await writeFile(resolve(output,'capture-manifest.json'),JSON.stringify({captured_at:new Date().toISOString(),status:'PASS',source_set_hash:before.source_set_hash,build_root:build.build_root,
  data_source:'ACTUAL_HTTPS_POSTGRESQL_MCP_PNG_BATCH_CONTENT_PRODUCTION_POST_QC_TWO_REVIEWS_AND_DELIVERY;SYNTHETIC_IDENTITY_PAYMENT_MODEL_VERDICTS_AND_PROCESS_IDENTITY',
  checks,screenshots,files,recording:inspection,browser_errors:errors,external_network_requests:external,browser_tabs_closed:browserClosed,owned_api_and_database_pool_closed:servicesClosed,
  real_service_or_payment_verified:false,native_mini_device_verified:false,full_product_verified:false},null,2)+'\n');
console.log(JSON.stringify({status:'PASS',checks:checks.length,media_files:files.length,browser_closed:browserClosed,services_closed:servicesClosed}));
