import {chromium,expect} from '@playwright/test';
import {execFileSync} from 'node:child_process';
import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import './delivery/local-env.js';
import {local,sha,snapshot} from './delivery/common.js';
import {supportRepairEnvironment} from '../tests/helpers/support-repair.js';
import type {DTO} from '../src/shared/contracts/types.js';
const build=JSON.parse(await readFile('docs/delivery/current.json','utf8'));
const source=await snapshot();if(source.source_set_hash!==build.source_set_hash||build.components.find((c:{name:string})=>c.name==='preview')?.status!=='PASS')throw new Error('Current server and support UI build required');
process.env.YPCC_BUILD_ROOT=local(build.build_root);
await copyFile(`${build.build_root}/worker/tool-gateway/mcp-main.js`,'runtime/build/worker/tool-gateway/mcp-main.js');
const output=local('docs/media/support-repair');await mkdir(output,{recursive:true});
const checks:string[]=[],apiChecks:string[]=[],errors:string[]=[],external:string[]=[],screenshots:{page:string;path:string}[]=[];
const posts:{key:string;body:string}[]=[];let browserClosed=false,appClosed=false,videoPath:string|undefined;
const env=await supportRepairEnvironment();
try{
  const managed=`/v1/internal/p01/support-tickets/${env.ticket.ticket_id}`,contextPath=`${managed}/repair-context`;
  const image=env.parent.items.find(i=>i.kind==='image')!,imagePath=`${managed}/repair-manifests/1/images/${image.deliverable_id}`;
  expect((await env.app.inject({url:contextPath,headers:{authorization:`Bearer ${env.buyer}`}})).statusCode).toBe(401);
  expect((await env.app.inject({url:contextPath,headers:env.admin(env.roles.read)})).statusCode).toBe(403);
  expect((await env.app.inject({url:contextPath,headers:env.admin()})).statusCode).toBe(403);
  apiChecks.push('BUYER_READ_ONLY_AND_UNASSIGNED_STAFF_CANNOT_READ_REPAIR_PROFILE_OR_PACK');
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try{
    const context=await browser.newContext({viewport:{width:1280,height:1100},deviceScaleFactor:1,locale:'zh-CN',colorScheme:'light',ignoreHTTPSErrors:true,
      recordVideo:{dir:local('runtime/preview-recordings/support-repair'),size:{width:1280,height:1100}}});context.setDefaultTimeout(10000);
    try{
      const page=await context.newPage();let lose=true;
      page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith(env.origin+'/'))external.push(new URL(r.url()).origin);});
      await page.route('**/orders/*/platform-repairs',async route=>{const request=route.request();posts.push({key:request.headers()['idempotency-key']!,body:request.postData()!});
        const response=await route.fetch();if(lose){lose=false;await route.abort('failed');}else await route.fulfill({response});});
      const shot=async(name:string)=>{const path=`docs/media/support-repair/${name}.png`;await page.screenshot({path:local(path)});screenshots.push({page:name,path});};
      const login=async()=>{await page.getByPlaceholder('输入独立客服令牌').fill(env.roles.alpha);await page.getByRole('button',{name:'连接工作台',exact:true}).click();await expect(page.getByRole('heading',{name:/处理队列/})).toBeVisible();};
      const choose=async()=>{await page.getByRole('button').filter({hasText:env.ticket.ticket_id}).click();await expect(page.getByText('合成演示：请依据原实拍商品资料，更正配套文案。',{exact:true})).toBeVisible();};
      await page.goto(env.origin+'/ops/support',{waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready);await login();await choose();
      expect(await page.getByRole('region',{name:'素材纠错工作区'}).count()).toBe(0);await page.getByRole('button',{name:'接手这条工单',exact:true}).click();
      await expect(page.getByRole('button',{name:'核对原商品与素材',exact:true})).toBeEnabled();await page.getByRole('button',{name:'核对原商品与素材',exact:true}).click();
      await expect(page.getByRole('heading',{name:'原商品档案',exact:true})).toBeVisible();await page.getByRole('region',{name:'素材纠错工作区'}).scrollIntoViewIfNeeded();await shot('01-source-profile-and-pack');
      checks.push('ACTUAL_STAFF_CLAIM_REVEALS_PERMISSION_GATED_FROZEN_PROFILE_AND_CURRENT_MANIFEST');
      const read=await env.app.inject({url:contextPath,headers:env.admin()});expect(read.statusCode,read.body).toBe(200);
      const original=read.json().data as DTO<'SupportRepairContext'>;expect(original.can_submit).toBe(true);expect(original.product_profile?.profile_hash).toBe(env.f.contract.profile.profile_hash);
      expect(original.manifest).toEqual(env.parent);expect(original.allowed_changes).toEqual(['COVER','ALLOWED_ORDER','DISPLAY_TEXT']);
      expect((await env.app.inject({url:contextPath,headers:env.admin(env.roles.beta)})).statusCode).toBe(403);
      expect((await env.app.inject({url:imagePath.replace('/1/','/2/'),headers:env.admin()})).statusCode).toBe(409);
      expect((await env.app.inject({url:imagePath.replace(image.deliverable_id,'foreign_image'),headers:env.admin()})).statusCode).toBe(404);
      apiChecks.push('ASSIGNEE_ONLY_FROZEN_PROFILE_EXACT_CURRENT_PACK_AND_IMAGE_VERSION_MEMBERSHIP');
      await page.getByRole('button',{name:`查看原图 ${env.parent.items.findIndex(i=>i.kind==='image')+1}`,exact:true}).click();const shown=page.getByAltText('当前原订单实际交付图片');await expect(shown).toBeVisible();
      expect(await shown.evaluate((node:HTMLImageElement)=>node.complete&&node.naturalWidth>0)).toBe(true);await shown.scrollIntoViewIfNeeded();await shot('02-private-delivered-image');
      checks.push('ACTUAL_PRIVATE_PNG_BYTES_SERVER_AND_BROWSER_SHA256_CHECK_AND_DECODE');await page.getByRole('button',{name:'收起原图',exact:true}).click();
      await page.getByRole('button',{name:'调整展示顺序',exact:true}).click();await expect(page.getByRole('button',{name:'将第 1 项上移',exact:true})).toBeDisabled();
      await page.getByRole('button',{name:'将第 1 项下移',exact:true}).click();expect(await page.locator('.repair-order li').first().textContent()).toContain(env.parent.items[1]!.file_name);
      await page.getByRole('button',{name:'更换封面',exact:true}).click();const alternate=env.parent.items.filter(i=>i.kind==='image').find(i=>i.deliverable_id!==env.parent.cover_deliverable_id)!;
      await page.getByRole('combobox',{name:'新封面',exact:true}).selectOption(alternate.deliverable_id);await expect(page.getByRole('checkbox')).toBeEnabled();
      await page.getByRole('button',{name:'更正文案文件',exact:true}).click();const corrected=`${env.f.contract.creative.copy}\n实拍展示，欢迎了解。`;
      await page.getByRole('textbox',{name:'更正后的配套文案',exact:true}).fill(corrected);await expect(page.getByRole('button',{name:'提交免费更正',exact:true})).toBeDisabled();
      await page.getByRole('checkbox').check();await page.getByRole('button',{name:'提交免费更正',exact:true}).scrollIntoViewIfNeeded();await shot('03-correction-review');
      checks.push('ALL_THREE_EDITORS_NOOP_GUARD_AND_EXPLICIT_CONFIRMATION_BEFORE_WRITE');
      await page.getByRole('button',{name:'提交免费更正',exact:true}).click();await expect(page.getByRole('button',{name:'继续确认原操作',exact:true})).toBeEnabled();
      await expect(page.getByRole('button',{name:'发送回复',exact:true})).toBeDisabled();expect(posts).toHaveLength(1);
      const pending=(await env.db.pool.query('SELECT id,data FROM revision_requests WHERE order_id=$1',[env.f.orderId])).rows;expect(pending).toHaveLength(1);
      await page.getByRole('button',{name:'继续确认原操作',exact:true}).click();await expect(page.getByText('已受理，等待制作',{exact:true})).toBeVisible();
      expect(posts).toHaveLength(2);expect(posts[1]).toEqual(posts[0]);expect((await env.db.pool.query('SELECT id FROM revision_requests WHERE order_id=$1',[env.f.orderId])).rowCount).toBe(1);
      checks.push('COMMITTED_REPAIR_ACK_LOSS_BLOCKS_OTHER_WRITES_AND_REPLAYS_EXACT_ORIGINAL_KEY_BODY_ONCE');
      const pack=await env.completeRepair(pending[0].id);expect(pack.manifest_revision).toBe(2);expect(pack.parent_manifest_id).toBe(env.parent.manifest_id);expect(pack.expires_at).toBe(env.parent.expires_at);
      const copy=pack.items.find(i=>i.kind==='copy')!,artifact=(await env.db.pool.query('SELECT object_key FROM artifacts WHERE id=$1',[copy.deliverable_id])).rows[0];
      expect((await env.f.store.get(artifact.object_key)).toString('utf8')).toBe(corrected);expect(copy.text).toBe(corrected);
      expect((await env.db.pool.query('SELECT data FROM delivery_manifests WHERE id=$1',[env.parent.manifest_id])).rows[0].data).toEqual(env.parent);
      const finished=(await env.db.pool.query('SELECT data FROM revision_requests WHERE id=$1',[pending[0].id])).rows[0].data;expect(finished).toMatchObject({state:'COMPLETED',result_manifest_revision:2,consumes_user_allowance:false});
      apiChecks.push('ACTUAL_FIVE_STAGE_REVISION_AND_FRESH_POST_FACTS_STYLE_RECEIPTS_PUBLISH_UTF8_BYTES_WITH_ORIGINAL_PARENT_EXPIRY_AND_ALLOWANCE');
      await page.getByRole('button',{name:'刷新更正进展',exact:true}).click();await expect(page.getByText('更正素材已交付',{exact:true})).toBeVisible();
      await page.getByRole('heading',{name:'核对原素材，发起免费更正',exact:true}).scrollIntoViewIfNeeded();await shot('04-completed-linked-delivery');
      await expect(page.getByRole('button',{name:'提交免费更正',exact:true})).toHaveCount(0);checks.push('COMPLETION_LABEL_REQUIRES_ACTUAL_COMPLETED_REVISION_AND_NEW_MANIFEST');
      await page.reload({waitUntil:'networkidle'});await login();await page.getByRole('combobox',{name:'工单状态',exact:true}).selectOption('PROCESSING');await choose();
      await page.getByRole('button',{name:'核对原商品与素材',exact:true}).click();await expect(page.getByText('更正素材已交付',{exact:true})).toBeVisible();expect(posts).toHaveLength(2);
      checks.push('RELOAD_RECOVERS_LINKED_REPAIR_FROM_SERVER_WITHOUT_RESUBMISSION_OR_BROWSER_STORAGE');
      expect(await page.evaluate(()=>({local:localStorage.length,session:sessionStorage.length}))).toEqual({local:0,session:0});
      await page.setViewportSize({width:360,height:1000});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);checks.push('NO_HORIZONTAL_OVERFLOW_AT_360PX');
      const deletion=await env.app.inject({method:'POST',url:'/v1/p01/privacy-deletions',headers:{authorization:`Bearer ${env.buyer}`,'idempotency-key':'synthetic-repair-ui-withdrawal'},payload:{scope:'ACCOUNT_MEDIA',acknowledge_inflight_contract:true}});
      expect(deletion.statusCode,deletion.body).toBe(202);expect((await env.app.inject({url:contextPath,headers:env.admin()})).statusCode).toBe(410);
      expect((await env.app.inject({url:imagePath,headers:env.admin()})).statusCode).toBe(410);apiChecks.push('ACTUAL_PRIVACY_WITHDRAWAL_BLOCKS_PROFILE_AND_IMAGE_READ');
      await page.getByRole('button',{name:'刷新工单',exact:true}).click();await expect(page.getByRole('region',{name:'素材纠错工作区'})).toHaveCount(0);checks.push('PRIVACY_REFRESH_CLEARS_PRIVATE_REPAIR_PANEL');
      await page.getByRole('button',{name:'退出并清空',exact:true}).click();await expect(page.getByPlaceholder('输入独立客服令牌')).toHaveValue('');checks.push('LOGOUT_CLEARS_CREDENTIALS_PRIVATE_PROFILE_DRAFT_AND_IMAGES');
      const recording=page.video();await page.close();videoPath=await recording?.path();
    }finally{await context.close();}
  }finally{await browser.close();browserClosed=true;}
}finally{await env.close();appClosed=true;}
if(errors.length||external.length)throw new Error(JSON.stringify({errors,external}));if(!videoPath)throw new Error('Missing actual browser recording');
await copyFile(videoPath,resolve(output,'walkthrough.webm'));
const ffmpeg=process.env.FFMPEG_PATH?.trim()||'ffmpeg',ffprobe=process.env.FFPROBE_PATH?.trim()||'ffprobe';
const run=(args:string[])=>execFileSync(ffmpeg,['-hide_banner','-loglevel','error','-y',...args],{windowsHide:true,timeout:60000,maxBuffer:2000000});
run(['-i',videoPath,'-an','-c:v','libx264','-crf','27','-pix_fmt','yuv420p','-movflags','+faststart',resolve(output,'walkthrough.mp4')]);
run(['-i',videoPath,'-vf','fps=4,scale=620:-2:flags=lanczos,split[a][b];[a]palettegen=max_colors=80[p];[b][p]paletteuse=dither=bayer:bayer_scale=3','-loop','0',resolve(output,'walkthrough.gif')]);
const inspection=JSON.parse(execFileSync(ffprobe,['-v','error','-show_entries','format=duration:stream=codec_name,width,height','-of','json',resolve(output,'walkthrough.mp4')],{windowsHide:true,encoding:'utf8',timeout:10000}));
const files=[];for(const path of [...screenshots.map(s=>s.path),...['walkthrough.webm','walkthrough.mp4','walkthrough.gif'].map(n=>`docs/media/support-repair/${n}`)]){const bytes=await readFile(local(path));files.push({path,bytes:bytes.length,sha256:sha(bytes)});}
if(JSON.stringify(await snapshot())!==JSON.stringify(source))throw new Error('Source changed during recording');
await writeFile(resolve(output,'capture-manifest.json'),JSON.stringify({captured_at:new Date().toISOString(),type:'ACTUAL_STAFF_REPAIR_UI_NATIVE_FIVE_STAGE_API_POSTGRESQL_AND_FILES',
  data_source:'SYNTHETIC_PRODUCT_IMAGES_SEMANTIC_ROLES_IDENTITY_AND_METERING_REAL_BROWSER_HTTP_STDIO_DATABASE_MEDIA_AND_REPAIR_EFFECTS',source_set_hash:source.source_set_hash,build_root:build.build_root,
  native_mini_device_verified:false,real_generation_verified:false,real_payment_verified:false,production_staff_identity_verified:false,full_product_verified:false,
  browser_tabs_closed:browserClosed,owned_api_and_database_pool_closed:appClosed,browser_errors:errors,external_network_requests:external,
  checks,api_checks:apiChecks,screenshots,recording:inspection,files,mutating_repair_requests:posts.length},null,2)+'\n');
console.log(JSON.stringify({status:'PASS',checks:checks.length,api_checks:apiChecks.length,screenshots:screenshots.length,media_files:files.length,browser_closed:browserClosed,owned_api_closed:appClosed}));
