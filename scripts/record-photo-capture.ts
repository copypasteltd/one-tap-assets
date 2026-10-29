import {chromium,expect} from '@playwright/test';
import {spawn,execFileSync} from 'node:child_process';
import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
import {resolve,relative} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import './delivery/local-env.js';
import {local,sha} from './delivery/common.js';

// Supplemental recording of the real shared page, using explicitly synthetic browser photos.
const report=JSON.parse(await readFile('docs/delivery/current.json','utf8')) as {build_root:string;source_set_hash:string;components:{name:string;status:string}[]};
if(report.components.find(c=>c.name==='preview')?.status!=='PASS')throw new Error('Build the current preview before recording');
const output=local('docs/media/photo-capture');await mkdir(output,{recursive:true});
const port=4174,origin=`http://127.0.0.1:${port}`,screenshots:{page:string;path:string}[]=[],checks:string[]=[],errors:string[]=[],external:string[]=[];
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
      recordVideo:{dir:local('runtime/preview-recordings/photo-capture'),size:{width:430,height:932}}});
    context.setDefaultTimeout(7000);
    try{
      const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
      page.on('requestfailed',r=>errors.push(`${r.method()} ${new URL(r.url()).pathname} ${r.failure()?.errorText}`));
      page.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith(origin+'/'))external.push(new URL(r.url()).origin);});
      await page.goto(origin+'/#/pages/photos/index',{waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready);
      const start=page.getByRole('button',{name:'开始识别商品',exact:true}),camera=page.getByRole('button',{name:'拍一张照片',exact:true});
      const photos=page.locator('.capture-photo .selected-photo');
      const shot=async(name:string)=>{await page.evaluate(()=>window.scrollTo(0,0));await page.waitForTimeout(200);
        const path=`docs/media/photo-capture/${name}.png`;await page.screenshot({path:local(path)});screenshots.push({page:name,path});};
      await expect(start).toBeDisabled();await expect(photos).toHaveCount(0);await shot('01-empty');checks.push('EMPTY_SET_CANNOT_START');
      for(let i=1;i<=3;i++){
        await camera.click();await expect(photos).toHaveCount(i);
        if(i<3)await expect(start).toBeDisabled();
      }await expect(start).toBeEnabled();checks.push('THREE_SEQUENTIAL_CAMERA_RETURNS_ACCUMULATE');await shot('02-three-photos');
      const original=await photos.evaluateAll(images=>images.map(img=>(img as HTMLImageElement).src));
      await page.getByRole('button',{name:'重拍第2张照片',exact:true}).click();
      await expect.poll(async()=>photos.nth(1).getAttribute('src')).not.toBe(original[1]);
      await expect(photos).toHaveCount(3);expect(await photos.nth(0).getAttribute('src')).toBe(original[0]);
      expect(await photos.nth(2).getAttribute('src')).toBe(original[2]);checks.push('RETAKE_REPLACES_ONLY_ONE_POSITION');
      const album=page.getByRole('button',{name:'从相册补充',exact:true});await album.click();await expect(photos).toHaveCount(5);
      await expect(camera).toBeDisabled();await expect(album).toBeDisabled();checks.push('ALBUM_RESPECTS_REMAINING_TWO_SLOTS');await shot('03-five-photos');
      for(const i of [5,4,3]){await page.getByRole('button',{name:`移除第${i}张照片`,exact:true}).click();await expect(photos).toHaveCount(i-1);}
      await expect(start).toBeDisabled();checks.push('REMOVE_BELOW_THREE_BLOCKS_START_AGAIN');
      await camera.click();await expect(photos).toHaveCount(3);await expect(start).toBeEnabled();
      await page.setViewportSize({width:320,height:800});await page.evaluate(()=>window.scrollTo(0,0));
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);checks.push('NO_HORIZONTAL_OVERFLOW_AT_320PX');
      await shot('04-narrow');await page.setViewportSize({width:430,height:932});
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
for(const path of [...screenshots.map(s=>s.path),...['walkthrough.webm','walkthrough.mp4','walkthrough.gif'].map(n=>`docs/media/photo-capture/${n}`)]){
  const bytes=await readFile(local(path));files.push({path,bytes:bytes.length,sha256:sha(bytes)});
}
const sourceFiles=[];
for(const path of ['scripts/record-photo-capture.ts','src/shared/ui/photos.tsx','src/shared/ui/theme.css','src/shared/client/photo-selection.ts','src/shared/platform/taro-host.ts','src/preview/fixtures.ts','src/preview/components.tsx']){
  const bytes=await readFile(local(path));sourceFiles.push({path,sha256:sha(bytes)});
}
await writeFile(resolve(output,'capture-manifest.json'),JSON.stringify({captured_at:new Date().toISOString(),type:'ACTUAL_BROWSER_RECORDING_SHARED_MINI_PHOTO_PAGE',
  data_source:'SYNTHETIC_SELF_DRAWN_PRODUCT_AND_CAMERA_RETURNS',source_set_hash:report.source_set_hash,build_root:report.build_root,
  native_mini_device_verified:false,real_generation_verified:false,real_payment_verified:false,browser_tabs_closed:browserClosed,
  owned_preview_server_stopped:server.exitCode!==null||server.signalCode!==null,browser_errors:errors,external_network_requests:external,
  checks,screenshots,recording:inspection,files,source_files:sourceFiles},null,2)+'\n');
console.log(JSON.stringify({status:'PASS',checks:checks.length,screenshots:screenshots.length,media_files:files.length,recording:inspection.format,
  browser_closed:browserClosed,server_stopped:server.exitCode!==null||server.signalCode!==null,path:relative(process.cwd(),output)}));
