import {chromium,expect} from '@playwright/test';
import {spawn,execFileSync} from 'node:child_process';
import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
import {resolve,relative} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import './delivery/local-env.js';
import {local,sha} from './delivery/common.js';

// Supplemental recording of actual shared delivery UI with synthetic support processing.
const report=JSON.parse(await readFile('docs/delivery/current.json','utf8')) as {build_root:string;source_set_hash:string;components:{name:string;status:string}[]};
if(report.components.find(c=>c.name==='preview')?.status!=='PASS')throw new Error('Build the current preview before recording');
const output=local('docs/media/support');await mkdir(output,{recursive:true});
const port=4177,origin=`http://127.0.0.1:${port}`,screenshots:{page:string;path:string}[]=[],checks:string[]=[],errors:string[]=[],external:string[]=[];
const server=spawn(process.execPath,['--import','tsx','scripts/delivery/serve-preview.ts'],{cwd:process.cwd(),windowsHide:true,shell:false,
  stdio:'ignore',env:{...process.env,YPCC_PREVIEW_DIRECTORY:local(`${report.build_root}/preview`),YPCC_PREVIEW_PORT:String(port)}});
let videoPath:string|undefined,browserClosed=false;
async function stopServer(){
  if(server.exitCode!==null||server.signalCode!==null)return;
  if(process.platform==='win32'){
    try{execFileSync('taskkill.exe',['/PID',String(server.pid),'/T','/F'],{windowsHide:true,stdio:'ignore',timeout:10000});}
    catch{server.kill();}
  }else server.kill('SIGTERM');
  if(server.exitCode===null&&server.signalCode===null)await Promise.race([new Promise<void>(done=>server.once('close',()=>done())),delay(5000)]);
}
try{
  let ready=false;
  for(let i=0;i<30;i++){
    if(server.exitCode!==null)throw new Error('Owned preview server stopped before readiness');
    try{ready=(await fetch(origin,{signal:AbortSignal.timeout(1000)})).ok;}catch{}
    if(ready)break;await delay(250);
  }if(!ready)throw new Error('Owned preview server was not ready');
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try{
    const context=await browser.newContext({viewport:{width:430,height:932},deviceScaleFactor:1,locale:'zh-CN',colorScheme:'light',
      recordVideo:{dir:local('runtime/preview-recordings/support'),size:{width:430,height:932}}});
    context.setDefaultTimeout(7000);
    try{
      const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
      page.on('requestfailed',r=>errors.push(`${r.method()} ${new URL(r.url()).pathname} ${r.failure()?.errorText}`));
      page.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith(origin+'/'))external.push(new URL(r.url()).origin);});
      await page.goto(origin+'/?scenario=support#/pages/help/index?order_id=demo_order',{waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready);
      const trace=()=>page.evaluate(()=>structuredClone((window as unknown as {__YPCC_SUPPORT_REPLAY__:{operations:string[];posts:{key:string;body:unknown}[];uploads:number}}).__YPCC_SUPPORT_REPLAY__));
      const shot=async(name:string,history=false)=>{await page.getByText(history?'我的反馈记录':'反馈这笔订单的问题',{exact:true}).scrollIntoViewIfNeeded();await page.waitForTimeout(200);
        const path=`docs/media/support/${name}.png`;await page.screenshot({path:local(path)});screenshots.push({page:name,path});};
      await expect(page.getByRole('button',{name:'提交问题',exact:true})).toBeDisabled();
      await expect(page.getByText('关联订单：demo_order',{exact:true}).first()).toBeVisible();expect((await trace()).posts).toEqual([]);
      await shot('01-feedback-form');checks.push('OWNED_ORDER_FEEDBACK_WITH_NO_AUTOMATIC_MUTATION');
      await page.getByRole('button',{name:'商品或文字错误',exact:true}).click();await expect(page.getByText('请指出商品或文字哪里不一致。平台制作错误走核实纠错，不占用一次自选小修改；受理后仍需核实。',{exact:true})).toBeVisible();
      await page.getByPlaceholder('描述遇到的问题，请勿填写密码、证件号码或完整支付凭证').fill('演示问题：配套文字与合成商品标签不一致。');checks.push('CLASSIFIED_FEEDBACK_AND_PLATFORM_ERROR_GUIDANCE');
      await page.getByRole('button',{name:'添加证明图片（0/5）',exact:true}).click();await expect(page.getByRole('button',{name:'添加证明图片（3/5）',exact:true})).toBeVisible();
      await page.getByRole('button',{name:'移除图片 2',exact:true}).click();await expect(page.getByRole('button',{name:'添加证明图片（2/5）',exact:true})).toBeVisible();expect((await trace()).uploads).toBe(0);checks.push('OPTIONAL_LOCAL_EVIDENCE_SELECTION_AND_REMOVAL_BEFORE_UPLOAD');
      await page.getByRole('button',{name:'提交问题',exact:true}).click();await expect(page.getByRole('button',{name:'继续提交这次反馈',exact:true})).toBeEnabled();
      await expect(page.getByRole('button',{name:'商品或文字错误',exact:true})).toBeDisabled();await expect(page.getByPlaceholder('描述遇到的问题，请勿填写密码、证件号码或完整支付凭证')).toBeDisabled();
      expect((await trace()).posts).toHaveLength(1);expect((await trace()).uploads).toBe(2);await shot('02-original-request-pending');checks.push('LOST_COMMITTED_ACK_PRESERVES_ORIGINAL_FEEDBACK_AND_LOCKS_EDITS');
      const original=(await trace()).posts[0]!;await page.getByRole('button',{name:'继续提交这次反馈',exact:true}).click();await expect(page.getByText('已受理，反馈编号：demo_feedback。受理不代表已退款或完成修复，请以订单和处理状态为准。',{exact:true})).toBeVisible();
      const after=await trace();expect(after.posts).toHaveLength(2);expect(after.posts[1]).toEqual(original);expect(after.uploads).toBe(2);await shot('03-feedback-accepted');checks.push('ORIGINAL_KEY_BODY_AND_COMPLETED_UPLOAD_REUSED_AFTER_ACK_LOSS');
      await expect(page.getByText('关联订单：demo_other_order',{exact:true})).toHaveCount(0);
      await page.getByRole('button',{name:'全部订单',exact:true}).click();await expect(page.getByText('关联订单：demo_other_order',{exact:true})).toHaveCount(1);await page.getByRole('button',{name:'这笔订单',exact:true}).click();checks.push('CURRENT_ORDER_AND_ALL_OWNED_RECORDS_FILTERS');
      const ticket=page.locator('.panel').filter({has:page.getByText('反馈编号：demo_feedback',{exact:true})});
      await ticket.getByRole('button',{name:'查询最新处理状态',exact:true}).click();await expect(ticket.getByText(/最新状态：处理中/)).toBeVisible();checks.push('LATEST_TICKET_GET_DISPLAYS_CURRENT_PROCESSING_STATE');
      await page.evaluate(()=>{location.hash='/pages/library/index';});await expect(page.getByText('我的素材与订单',{exact:true})).toBeVisible();
      await page.evaluate(()=>{location.hash='/pages/help/index';});await expect(page.getByText('我的反馈记录',{exact:true})).toBeVisible();await expect(page.getByText('反馈编号：demo_feedback',{exact:true})).toBeVisible();
      await expect(page.getByText('反馈这笔订单的问题',{exact:true})).toHaveCount(0);expect((await trace()).posts).toHaveLength(2);await shot('04-reopened-history',true);checks.push('REOPENED_ACCOUNT_HISTORY_WITHOUT_RESUBMISSION_OR_ORDER_REQUIRED');
      expect((await trace()).operations.filter(n=>['createOrder','createQuote','getOrCreatePaymentAction','requestLimitedRevision','requestRefund','createPlan'].includes(n))).toEqual([]);checks.push('FEEDBACK_ACCEPTANCE_NEVER_IMPLIES_PAYMENT_REFUND_OR_REPAIR');
      await page.setViewportSize({width:320,height:800});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);checks.push('NO_HORIZONTAL_OVERFLOW_AT_320PX');await page.setViewportSize({width:430,height:932});
      const recording=page.video();await page.close();videoPath=await recording?.path();
    }finally{await context.close();}
  }finally{await browser.close();browserClosed=true;}
}finally{await stopServer();}
if(errors.length||external.length)throw new Error(JSON.stringify({browser_errors:errors,external_origins:external}));
if(!videoPath)throw new Error('Missing actual browser recording');
await copyFile(videoPath,resolve(output,'walkthrough.webm'));
const ffmpeg=process.env.FFMPEG_PATH?.trim()||'ffmpeg',ffprobe=process.env.FFPROBE_PATH?.trim()||'ffprobe';
const run=(args:string[])=>execFileSync(ffmpeg,['-hide_banner','-loglevel','error','-y',...args],{windowsHide:true,timeout:30000,maxBuffer:2000000});
run(['-i',videoPath,'-an','-c:v','libx264','-crf','26','-pix_fmt','yuv420p','-movflags','+faststart',resolve(output,'walkthrough.mp4')]);
run(['-i',videoPath,'-vf','fps=6,scale=300:-2:flags=lanczos,split[a][b];[a]palettegen=max_colors=80[p];[b][p]paletteuse=dither=bayer:bayer_scale=3','-loop','0',resolve(output,'walkthrough.gif')]);
const inspection=JSON.parse(execFileSync(ffprobe,['-v','error','-show_entries','format=duration:stream=codec_name,width,height','-of','json',resolve(output,'walkthrough.mp4')],{windowsHide:true,encoding:'utf8',timeout:10000}));
const files=[];
for(const path of [...screenshots.map(s=>s.path),...['walkthrough.webm','walkthrough.mp4','walkthrough.gif'].map(n=>`docs/media/support/${n}`)]){
  const bytes=await readFile(local(path));files.push({path,bytes:bytes.length,sha256:sha(bytes)});
}
const sourceFiles=[];
for(const path of ['scripts/record-support.ts','src/shared/ui/help.tsx','src/shared/ui/pages.tsx','src/shared/client/support.ts','src/shared/client/evidence.ts','src/api/modules/support.ts','src/shared/ui/theme.css','src/preview/fixtures.ts']){
  const bytes=await readFile(local(path));sourceFiles.push({path,sha256:sha(bytes)});
}
await writeFile(resolve(output,'capture-manifest.json'),JSON.stringify({captured_at:new Date().toISOString(),type:'ACTUAL_BROWSER_RECORDING_SHARED_MINI_SUPPORT',
  data_source:'SYNTHETIC_SUPPORT_STATE_AND_UPLOAD_CALLBACKS_NO_STAFF_OR_DEVICE_CLAIM',source_set_hash:report.source_set_hash,build_root:report.build_root,
  native_mini_device_verified:false,real_generation_verified:false,real_payment_verified:false,browser_tabs_closed:browserClosed,
  owned_preview_server_stopped:server.exitCode!==null||server.signalCode!==null,browser_errors:errors,external_network_requests:external,
  checks,screenshots,recording:inspection,files,source_files:sourceFiles},null,2)+'\n');
console.log(JSON.stringify({status:'PASS',checks:checks.length,screenshots:screenshots.length,media_files:files.length,recording:inspection.format,
  browser_closed:browserClosed,server_stopped:server.exitCode!==null||server.signalCode!==null,path:relative(process.cwd(),output)}));
