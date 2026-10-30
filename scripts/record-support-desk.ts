import {chromium,expect} from '@playwright/test';
import {execFileSync} from 'node:child_process';
import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import './delivery/local-env.js';
import {local,sha} from './delivery/common.js';
import {supportDeskEnvironment} from '../tests/helpers/support-desk.js';
const build=JSON.parse(await readFile('docs/delivery/current.json','utf8')) as {build_root:string;source_set_hash:string;components:{name:string;status:string}[]};
if(build.components.find(c=>c.name==='preview')?.status!=='PASS')throw new Error('Build the current support page first');
process.env.YPCC_BUILD_ROOT=local(build.build_root);
const output=local('docs/media/support-desk');await mkdir(output,{recursive:true});
const env=await supportDeskEnvironment();const checks:string[]=[],apiChecks:string[]=[],errors:string[]=[],external:string[]=[],screenshots:{page:string;path:string}[]=[];
let videoPath:string|undefined,browserClosed=false,appClosed=false;const posts:{key:string;body:string}[]=[];
try{
  const fixture=await env.fixture(true),origin=await env.app.listen({host:'127.0.0.1',port:0});
  const managed=`/v1/internal/p01/support-tickets/${fixture.ticket.ticket_id}`;
  expect((await env.app.inject({url:managed,headers:fixture.headers})).statusCode).toBe(401);
  expect((await env.app.inject({url:managed,headers:env.admin(env.roles.write)})).statusCode).toBe(403);
  expect((await env.app.inject({url:`${managed}/evidence/${fixture.ids[0]}`,headers:env.admin(env.roles.read)})).statusCode).toBe(403);
  const queue=await env.app.inject({url:'/v1/internal/p01/support-tickets',headers:env.admin()});expect(queue.statusCode,queue.body).toBe(200);expect(queue.body).not.toContain('合成反馈');expect(queue.body).not.toContain(fixture.ids[0]!);
  apiChecks.push('INDEPENDENT_BUYER_READ_WRITE_PROOF_PERMISSIONS_AND_METADATA_ONLY_QUEUE');
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try{
    const context=await browser.newContext({viewport:{width:1280,height:960},deviceScaleFactor:1,locale:'zh-CN',colorScheme:'light',recordVideo:{dir:local('runtime/preview-recordings/support-desk'),size:{width:1280,height:960}}});
    context.setDefaultTimeout(9000);
    try{
      const page=await context.newPage();let lose=true;
      page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith(origin+'/'))external.push(new URL(r.url()).origin);});
      await page.route('**/support-tickets/*/process',async route=>{const request=route.request();posts.push({key:request.headers()['idempotency-key']!,body:request.postData()!});const response=await route.fetch();
        if(lose){lose=false;await route.abort('failed');}else await route.fulfill({response});});
      const shot=async(name:string)=>{const path=`docs/media/support-desk/${name}.png`;await page.screenshot({path:local(path)});screenshots.push({page:name,path});};
      await page.goto(origin+'/ops/support',{waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready);
      await expect(page.getByRole('button',{name:'连接工作台',exact:true})).toBeDisabled();expect(posts).toEqual([]);await shot('01-independent-login');checks.push('PUBLIC_LOGIN_SHELL_WITHOUT_PRIVATE_QUEUE_OR_STORED_CREDENTIAL');
      await page.getByPlaceholder('输入独立客服令牌').fill(env.roles.alpha);await page.getByRole('button',{name:'连接工作台',exact:true}).click();
      await expect(page.getByRole('heading',{name:/处理队列/})).toBeVisible();await page.getByRole('button').filter({hasText:fixture.ticket.ticket_id}).click();
      await expect(page.getByText('合成反馈：保存图片后仍想了解原订单处理进展。',{exact:true})).toBeVisible();checks.push('ACTUAL_POSTGRESQL_QUEUE_AND_AUDITED_DETAIL_READ');
      await page.getByRole('button',{name:'查看证明图片 1',exact:true}).click();const image=page.getByAltText('当前工单的授权证明图片');await expect(image).toBeVisible();
      expect(await image.evaluate((node:HTMLImageElement)=>node.complete&&node.naturalWidth===1024)).toBe(true);await image.scrollIntoViewIfNeeded();await shot('02-authorized-proof');checks.push('ACTUAL_UPLOADED_NORMALIZED_PNG_READ_AND_BROWSER_DECODE');
      await page.getByRole('button',{name:'收起证明图片',exact:true}).click();await page.getByRole('button',{name:'接手这条工单',exact:true}).click();
      await expect(page.getByRole('button',{name:'继续确认原操作',exact:true})).toBeEnabled();await expect(page.getByRole('button',{name:'接手这条工单',exact:true})).toBeDisabled();await shot('03-original-claim-pending');checks.push('COMMITTED_CLAIM_ACK_LOSS_FREEZES_NEW_WRITES');
      await page.getByRole('button',{name:'继续确认原操作',exact:true}).click();await expect(page.getByText('处理中 · 版本 1',{exact:true})).toBeVisible();
      expect(posts).toHaveLength(2);expect(posts[1]).toEqual(posts[0]);expect((await env.db.pool.query('SELECT data FROM support_tickets WHERE id=$1',[fixture.ticket.ticket_id])).rows[0].data.revision).toBe(1);checks.push('ORIGINAL_CLAIM_KEY_BODY_REPLAY_WITH_ONE_STATE_TRANSITION');
      await page.getByPlaceholder('说明核实结果、处理建议或当前进展').fill('已核对：请回到素材领取页，重新授权相册后重试未确认项。');await page.getByRole('button',{name:'发送回复',exact:true}).click();
      await expect(page.getByText('处理中 · 版本 2',{exact:true})).toBeVisible();
      const buyer=await env.app.inject({url:`/v1/p01/tickets/${fixture.ticket.ticket_id}`,headers:fixture.headers});expect(buyer.statusCode,buyer.body).toBe(200);expect(buyer.json().data.response.message).toContain('重新授权相册');checks.push('ACTUAL_STAFF_REPLY_RETURNED_BY_OWNED_BUYER_API');
      const other=await env.fixture();expect((await env.app.inject({url:`/v1/p01/tickets/${fixture.ticket.ticket_id}`,headers:other.headers})).statusCode).toBe(404);
      expect((await env.app.inject({method:'POST',url:`${managed}/process`,headers:{...env.admin(env.roles.beta),'idempotency-key':'browser-other-staff'},payload:{expected_revision:2,action:'REPLY',message:'Forbidden other staff'}})).statusCode).toBe(403);
      apiChecks.push('OWNED_BUYER_REPLY_AND_ASSIGNEE_ONLY_WRITES');
      await page.getByPlaceholder('说明核实结果、处理建议或当前进展').fill('已提供处理步骤。退款和素材结果仍以原订单为准。');await page.getByRole('button',{name:'回复并标记已解决',exact:true}).click();
      await expect(page.getByText('已处理 · 版本 3',{exact:true})).toBeVisible();await page.getByRole('heading',{name:'最近一次客服回复',exact:true}).scrollIntoViewIfNeeded();await shot('04-reply-and-resolution');
      await page.getByRole('button',{name:'关闭已解决工单',exact:true}).click();await expect(page.getByText('已关闭 · 版本 4',{exact:true})).toBeVisible();checks.push('ACTUAL_RESOLUTION_AND_CLOSE_WITHOUT_REFUND_OR_REPAIR');
      expect((await env.db.pool.query('SELECT id FROM refunds WHERE order_id=$1 UNION ALL SELECT id FROM revision_requests WHERE order_id=$1',[fixture.orderId])).rowCount).toBe(0);
      expect(await page.evaluate(()=>({local:localStorage.length,session:sessionStorage.length}))).toEqual({local:0,session:0});checks.push('CREDENTIAL_AND_PRIVATE_CORRESPONDENCE_NOT_PERSISTED_IN_BROWSER_STORAGE');
      await page.setViewportSize({width:360,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);checks.push('NO_HORIZONTAL_OVERFLOW_AT_360PX');
      await page.getByRole('button',{name:'退出并清空',exact:true}).click();await expect(page.getByPlaceholder('输入独立客服令牌')).toHaveValue('');await expect(page.getByText('最近一次客服回复',{exact:true})).toHaveCount(0);checks.push('LOGOUT_CLEARS_PRIVATE_PAGE_AND_CONNECTION_STATE');
      const race=await Promise.all([env.roles.alpha,env.roles.beta].map((token,index)=>env.app.inject({method:'POST',url:`/v1/internal/p01/support-tickets/${other.ticket.ticket_id}/process`,
        headers:{...env.admin(token),'idempotency-key':`browser-race-${index}`},payload:{expected_revision:0,action:'CLAIM'}})));
      expect(race.map(r=>r.statusCode).sort()).toEqual([200,409]);apiChecks.push('CONCURRENT_ACTUAL_POSTGRESQL_CLAIMS_ONLY_ONE_VERSION_SUCCEEDS');
      const deletion=await env.app.inject({method:'POST',url:'/v1/p01/privacy-deletions',headers:{...fixture.headers,'idempotency-key':'browser-support-privacy'},payload:{scope:'ACCOUNT_MEDIA',acknowledge_inflight_contract:true}});
      expect(deletion.statusCode,deletion.body).toBe(202);const withdrawn=await env.app.inject({url:managed,headers:env.admin()});expect(withdrawn.json().data).toMatchObject({summary:{content_available:false},message:null,attachment_asset_ids:[],response:null});
      expect((await env.app.inject({url:`${managed}/evidence/${fixture.ids[0]}`,headers:env.admin()})).statusCode).toBe(410);
      expect((await env.app.inject({method:'POST',url:`${managed}/process`,headers:{...env.admin(),'idempotency-key':'browser-after-delete'},payload:{expected_revision:4,action:'REPLY',message:'Must not restore'}})).statusCode).toBe(410);
      const withdrawnBuyer=await env.app.inject({url:`/v1/p01/tickets/${fixture.ticket.ticket_id}`,headers:fixture.headers});expect(withdrawnBuyer.json().data.response).toBeUndefined();
      apiChecks.push('ACTUAL_PRIVACY_REQUEST_IMMEDIATELY_HIDES_AND_BLOCKS_PRIVATE_CORRESPONDENCE_AND_PROOF');
      const recording=page.video();await page.close();videoPath=await recording?.path();
    }finally{await context.close();}
  }finally{await browser.close();browserClosed=true;}
}finally{await env.close();appClosed=true;}
if(errors.length||external.length)throw new Error(JSON.stringify({errors,external}));if(!videoPath)throw new Error('Missing real browser video');
await copyFile(videoPath,resolve(output,'walkthrough.webm'));
const ffmpeg=process.env.FFMPEG_PATH?.trim()||'ffmpeg',ffprobe=process.env.FFPROBE_PATH?.trim()||'ffprobe';
const run=(args:string[])=>execFileSync(ffmpeg,['-hide_banner','-loglevel','error','-y',...args],{windowsHide:true,timeout:60000,maxBuffer:2000000});
run(['-i',videoPath,'-an','-c:v','libx264','-crf','27','-pix_fmt','yuv420p','-movflags','+faststart',resolve(output,'walkthrough.mp4')]);
run(['-i',videoPath,'-vf','fps=4,scale=620:-2:flags=lanczos,split[a][b];[a]palettegen=max_colors=80[p];[b][p]paletteuse=dither=bayer:bayer_scale=3','-loop','0',resolve(output,'walkthrough.gif')]);
const inspection=JSON.parse(execFileSync(ffprobe,['-v','error','-show_entries','format=duration:stream=codec_name,width,height','-of','json',resolve(output,'walkthrough.mp4')],{windowsHide:true,encoding:'utf8',timeout:10000}));
const files=[];for(const path of [...screenshots.map(s=>s.path),...['walkthrough.webm','walkthrough.mp4','walkthrough.gif'].map(n=>`docs/media/support-desk/${n}`)]){const bytes=await readFile(local(path));files.push({path,bytes:bytes.length,sha256:sha(bytes)});}
const sourceFiles=[];for(const path of ['scripts/record-support-desk.ts','src/api/modules/support-desk.ts','src/api/routes/support-console.ts','src/shared/client/support-desk.ts','src/preview/support-main.tsx','src/preview/support-console.css','src/shared/ui/help.tsx','tests/helpers/support-desk.ts']){sourceFiles.push({path,sha256:sha(await readFile(local(path)))});}
await writeFile(resolve(output,'capture-manifest.json'),JSON.stringify({captured_at:new Date().toISOString(),type:'ACTUAL_STAFF_UI_NATIVE_API_AND_POSTGRESQL',
  data_source:'SYNTHETIC_CUSTOMER_ORDER_IMAGE_CREDENTIAL_AND_ACK_FAULT_REAL_LOCAL_HTTP_DATABASE_AND_FILE_EFFECTS',source_set_hash:build.source_set_hash,build_root:build.build_root,
  native_mini_device_verified:false,real_generation_verified:false,real_payment_verified:false,production_staff_identity_verified:false,
  browser_tabs_closed:browserClosed,owned_api_and_database_pool_closed:appClosed,browser_errors:errors,external_network_requests:external,
  checks,api_checks:apiChecks,screenshots,recording:inspection,files,source_files:sourceFiles,mutating_requests:posts.length},null,2)+'\n');
console.log(JSON.stringify({status:'PASS',checks:checks.length,api_checks:apiChecks.length,screenshots:screenshots.length,media_files:files.length,browser_closed:browserClosed,owned_api_closed:appClosed}));
