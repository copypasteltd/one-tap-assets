import {chromium,expect} from '@playwright/test';
import {spawn,execFileSync} from 'node:child_process';
import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
import {resolve,relative} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import './delivery/local-env.js';
import {local,sha} from './delivery/common.js';

// Supplemental recording of actual shared delivery UI with synthetic album callbacks.
const report=JSON.parse(await readFile('docs/delivery/current.json','utf8')) as {build_root:string;source_set_hash:string;components:{name:string;status:string}[]};
if(report.components.find(c=>c.name==='preview')?.status!=='PASS')throw new Error('Build the current preview before recording');
const output=local('docs/media/album-save');await mkdir(output,{recursive:true});
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
      recordVideo:{dir:local('runtime/preview-recordings/album-save'),size:{width:430,height:932}}});
    context.setDefaultTimeout(7000);
    try{
      const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
      page.on('requestfailed',r=>errors.push(`${r.method()} ${new URL(r.url()).pathname} ${r.failure()?.errorText}`));
      page.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith(origin+'/'))external.push(new URL(r.url()).origin);});
      await page.goto(origin+'/?scenario=album-save#/pages/pack/index?order_id=demo_order',{waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready);
      const trace=()=>page.evaluate(()=>structuredClone((window as unknown as {__YPCC_ALBUM_REPLAY__:{operations:string[];saves:string[]}}).__YPCC_ALBUM_REPLAY__));
      const shot=async(name:string)=>{await page.evaluate(()=>window.scrollTo(0,0));await page.waitForTimeout(200);
        const path=`docs/media/album-save/${name}.png`;await page.screenshot({path:local(path)});screenshots.push({page:name,path});};
      await expect(page.getByRole('button',{name:'保存素材到相册',exact:true})).toBeVisible();
      await expect(page.getByRole('button',{name:'只存图片',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'只存视频',exact:true})).toBeVisible();
      expect((await trace()).saves).toEqual([]);expect((await trace()).operations).not.toContain('createSaveSession');await shot('01-save-options');checks.push('ALL_IMAGE_AND_VIDEO_ACTIONS_WITH_NO_AUTOMATIC_NATIVE_SAVE');
      await page.getByRole('button',{name:'只存图片',exact:true}).click();await expect(page.getByText('图片 1 · 已保存',{exact:true})).toBeVisible();
      await expect(page.getByText('图片 2 · 保存未完成',{exact:true})).toBeVisible();await expect(page.getByText('短片 1 · 等待保存',{exact:true})).toBeVisible();
      expect((await trace()).saves).toEqual(['demo_image','demo_image_detail']);await shot('02-partial-save');checks.push('IMAGE_ONLY_PRESERVES_PARTIAL_SUCCESS_AND_DOES_NOT_SAVE_VIDEO_OR_COPY');
      await page.getByRole('button',{name:'重试这项',exact:true}).click();await expect(page.getByText('图片 2 · 已保存',{exact:true})).toBeVisible();
      expect((await trace()).saves).toEqual(['demo_image','demo_image_detail','demo_image_detail']);checks.push('ITEM_RETRY_SKIPS_CONFIRMED_SUCCESS_AND_UNRELATED_MEDIA');
      await page.getByRole('button',{name:'只存视频',exact:true}).click();await expect(page.getByText('短片 1 · 需要核对相册',{exact:true})).toBeVisible();checks.push('UNKNOWN_CALLBACK_IS_NOT_SAVED');
      const original=(await trace()).saves;await page.getByRole('button',{name:'保存素材到相册',exact:true}).click();
      await expect(page.getByRole('button',{name:'保存素材到相册',exact:true})).toBeEnabled();expect((await trace()).saves).toEqual(original);checks.push('WHOLE_PACK_RETRY_SKIPS_SAVED_AND_UNCONFIRMED_UNKNOWN_ITEMS');
      await page.evaluate(()=>{location.hash='/pages/library/index';});await expect(page.getByText('我的素材与订单',{exact:true})).toBeVisible();
      await page.evaluate(()=>{location.hash='/pages/pack/index?order_id=demo_order';});await expect(page.getByText('短片 1 · 需要核对相册',{exact:true})).toBeVisible();
      expect((await trace()).saves).toEqual(original);expect((await trace()).operations.filter(n=>n==='createSaveSession')).toHaveLength(1);await shot('03-restored-progress');checks.push('REOPEN_RESTORES_ORIGINAL_INSTALLATION_JOURNAL_WITHOUT_NEW_SESSION_OR_NATIVE_WRITE');
      page.once('dialog',d=>d.dismiss());await page.getByRole('button',{name:'已核对，重试',exact:true}).click();
      await expect(page.getByRole('button',{name:'已核对，重试',exact:true})).toBeEnabled();expect((await trace()).saves).toEqual(original);checks.push('DISMISSED_MISSING_CONFIRMATION_NEVER_REPEATS_NATIVE_SAVE');
      page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'已核对，重试',exact:true}).click();await expect(page.getByText('短片 1 · 已保存',{exact:true})).toBeVisible();
      expect((await trace()).saves).toEqual([...original,'demo_video']);await expect(page.getByText('已确认保存 3 / 3 项 · 待核对 0 项 · 未完成 0 项',{exact:true})).toBeVisible();await shot('04-confirmed-completion');checks.push('EXPLICIT_MISSING_CONFIRMATION_RETRIES_ONLY_ORIGINAL_UNKNOWN_VIDEO');
      await expect(page.getByRole('button',{name:'复制文案',exact:true})).toHaveCount(1);
      expect((await trace()).operations.filter(n=>['createOrder','createQuote','getOrCreatePaymentAction','createPlan'].includes(n))).toEqual([]);checks.push('COPY_SEPARATE_FROM_ALBUM_WITH_NO_REGENERATION_OR_PAYMENT');
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
for(const path of [...screenshots.map(s=>s.path),...['walkthrough.webm','walkthrough.mp4','walkthrough.gif'].map(n=>`docs/media/album-save/${n}`)]){
  const bytes=await readFile(local(path));files.push({path,bytes:bytes.length,sha256:sha(bytes)});
}
const sourceFiles=[];
for(const path of ['scripts/record-album-save.ts','src/shared/ui/pack.tsx','src/shared/ui/pages.tsx','src/shared/client/album.ts','src/shared/platform/album-save.ts','src/mini-alipay/host.ts','src/mini-douyin/host.ts','src/shared/ui/theme.css','src/preview/fixtures.ts']){
  const bytes=await readFile(local(path));sourceFiles.push({path,sha256:sha(bytes)});
}
await writeFile(resolve(output,'capture-manifest.json'),JSON.stringify({captured_at:new Date().toISOString(),type:'ACTUAL_BROWSER_RECORDING_SHARED_MINI_ALBUM_SAVE',
  data_source:'SYNTHETIC_ALBUM_CALLBACKS_NO_DEVICE_WRITES',source_set_hash:report.source_set_hash,build_root:report.build_root,
  native_mini_device_verified:false,real_generation_verified:false,real_payment_verified:false,browser_tabs_closed:browserClosed,
  owned_preview_server_stopped:server.exitCode!==null||server.signalCode!==null,browser_errors:errors,external_network_requests:external,
  checks,screenshots,recording:inspection,files,source_files:sourceFiles},null,2)+'\n');
console.log(JSON.stringify({status:'PASS',checks:checks.length,screenshots:screenshots.length,media_files:files.length,recording:inspection.format,
  browser_closed:browserClosed,server_stopped:server.exitCode!==null||server.signalCode!==null,path:relative(process.cwd(),output)}));
