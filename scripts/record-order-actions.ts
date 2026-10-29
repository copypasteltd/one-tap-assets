import {chromium,expect} from '@playwright/test';
import {spawn,execFileSync} from 'node:child_process';
import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
import {resolve,relative} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import './delivery/local-env.js';
import {local,sha} from './delivery/common.js';

// Supplemental recording of actual shared order UI with synthetic order/refund states.
const report=JSON.parse(await readFile('docs/delivery/current.json','utf8')) as {build_root:string;source_set_hash:string;components:{name:string;status:string}[]};
if(report.components.find(c=>c.name==='preview')?.status!=='PASS')throw new Error('Build the current preview before recording');
const output=local('docs/media/order-actions');await mkdir(output,{recursive:true});
const port=4176,origin=`http://127.0.0.1:${port}`,screenshots:{page:string;path:string}[]=[],checks:string[]=[],errors:string[]=[],external:string[]=[];
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
      recordVideo:{dir:local('runtime/preview-recordings/order-actions'),size:{width:430,height:932}}});
    context.setDefaultTimeout(7000);
    try{
      const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
      page.on('requestfailed',r=>errors.push(`${r.method()} ${new URL(r.url()).pathname} ${r.failure()?.errorText}`));
      page.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith(origin+'/'))external.push(new URL(r.url()).origin);});
      await page.goto(origin+'/?scenario=order-actions#/pages/order/index?order_id=demo_pending',{waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready);
      const go=async(id:string)=>{await page.goto(origin+`/?scenario=order-actions#/pages/order/index?order_id=${id}`,{waitUntil:'networkidle'});};
      const shot=async(name:string)=>{await page.evaluate(()=>window.scrollTo(0,0));await page.waitForTimeout(200);
        const path=`docs/media/order-actions/${name}.png`;await page.screenshot({path:local(path)});screenshots.push({page:name,path});};
      const pay=()=>page.getByRole('button',{name:'继续原单付款',exact:true}),cancel=()=>page.getByRole('button',{name:'取消这笔订单',exact:true});
      await expect(pay()).toBeVisible();await expect(cancel()).toBeVisible();await shot('01-original-order');checks.push('PENDING_ORDER_HAS_ORIGINAL_PAYMENT_AND_CANCEL_ACTIONS');
      page.once('dialog',d=>d.dismiss());await cancel().click();await expect(cancel()).toBeVisible();checks.push('DISMISSED_CONFIRMATION_PRESERVES_ORDER');
      page.once('dialog',d=>d.accept());await cancel().click();await expect(page.getByText('制作已取消',{exact:true})).toBeVisible();
      await expect(pay()).toHaveCount(0);await expect(cancel()).toHaveCount(0);await shot('02-cancelled');checks.push('CONFIRMED_CANCEL_REMOVES_PAYMENT_AND_CANCEL_ACTIONS');
      await go('demo_unknown');await expect(page.getByText('付款结果待确认',{exact:true})).toBeVisible();await expect(pay()).toHaveCount(0);checks.push('UNKNOWN_PAYMENT_NEVER_OFFERS_ANOTHER_PAYMENT');
      await go('demo_queued');page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'取消排队并申请退款',exact:true}).click();
      await expect(page.getByText('退款申请已受理',{exact:true})).toBeVisible();await expect(page.getByText('原路退款已确认',{exact:true})).toHaveCount(0);
      await shot('03-refund-requested');checks.push('QUEUED_PAID_CANCEL_SHOWS_REQUESTED_NOT_RECEIVED_REFUND');
      await go('demo_failed');page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'申请原路退款',exact:true}).click();
      await expect(page.getByText('退款申请已受理',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'申请原路退款',exact:true})).toHaveCount(0);
      await page.getByRole('button',{name:'查询原单最新状态',exact:true}).click();await expect(page.getByText('退款申请已受理',{exact:true})).toBeVisible();checks.push('FAILED_ORDER_REFUND_IS_QUERIED_WITHOUT_ANOTHER_REQUEST');
      await go('demo_working');await expect(page.getByRole('button',{name:'订单售后与问题反馈',exact:true})).toBeVisible();
      await expect(cancel()).toHaveCount(0);await expect(page.getByRole('button',{name:'申请原路退款',exact:true})).toHaveCount(0);
      await shot('04-production-support');checks.push('STARTED_PRODUCTION_ROUTES_TO_AFTERCARE');
      await go('demo_refunded');await expect(page.getByText('原路退款已确认',{exact:true})).toBeVisible();checks.push('ONLY_CONFIRMED_REFUND_DISPLAYS_RECEIVED');
      await page.setViewportSize({width:320,height:800});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      checks.push('NO_HORIZONTAL_OVERFLOW_AT_320PX');await page.setViewportSize({width:430,height:932});
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
for(const path of [...screenshots.map(s=>s.path),...['walkthrough.webm','walkthrough.mp4','walkthrough.gif'].map(n=>`docs/media/order-actions/${n}`)]){
  const bytes=await readFile(local(path));files.push({path,bytes:bytes.length,sha256:sha(bytes)});
}
const sourceFiles=[];
for(const path of ['scripts/record-order-actions.ts','src/shared/ui/order.tsx','src/shared/ui/pages.tsx','src/shared/client/order-actions.ts','src/api/modules/payment-actions.ts','src/api/routes/business.ts','src/api/db/store.ts','src/preview/fixtures.ts']){
  const bytes=await readFile(local(path));sourceFiles.push({path,sha256:sha(bytes)});
}
await writeFile(resolve(output,'capture-manifest.json'),JSON.stringify({captured_at:new Date().toISOString(),type:'ACTUAL_BROWSER_RECORDING_SHARED_MINI_ORDER_ACTIONS',
  data_source:'SYNTHETIC_ORDERS_REFUNDS_AND_PAYMENT_STATES',source_set_hash:report.source_set_hash,build_root:report.build_root,
  native_mini_device_verified:false,real_generation_verified:false,real_payment_verified:false,browser_tabs_closed:browserClosed,
  owned_preview_server_stopped:server.exitCode!==null||server.signalCode!==null,browser_errors:errors,external_network_requests:external,
  checks,screenshots,recording:inspection,files,source_files:sourceFiles},null,2)+'\n');
console.log(JSON.stringify({status:'PASS',checks:checks.length,screenshots:screenshots.length,media_files:files.length,recording:inspection.format,
  browser_closed:browserClosed,server_stopped:server.exitCode!==null||server.signalCode!==null,path:relative(process.cwd(),output)}));
