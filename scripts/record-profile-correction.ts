import {chromium,expect} from '@playwright/test';
import {spawn,execFileSync} from 'node:child_process';
import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
import {resolve,relative} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import './delivery/local-env.js';
import {local,sha,snapshot} from './delivery/common.js';

// Actual shared mini-program UI, with explicit synthetic product/correction metadata and ACK loss; not a real mini-program device or multimodal result.
const report=JSON.parse(await readFile('docs/delivery/current.json','utf8')) as {build_root:string;source_set_hash:string;components:{name:string;status:string}[]};
if(report.source_set_hash!==(await snapshot()).source_set_hash||report.components.find(c=>c.name==='preview')?.status!=='PASS')throw new Error('Build the current preview before recording');
const output=local('docs/media/profile-correction');await mkdir(output,{recursive:true});
const port=4179,origin=`http://127.0.0.1:${port}`,screenshots:{page:string;path:string}[]=[],checks:string[]=[],errors:string[]=[],external:string[]=[];
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
      recordVideo:{dir:local('runtime/preview-recordings/profile-correction'),size:{width:430,height:932}}});
    context.setDefaultTimeout(7000);
    try{
      const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
      page.on('requestfailed',r=>errors.push(`${r.method()} ${new URL(r.url()).pathname} ${r.failure()?.errorText}`));
      page.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith(origin+'/'))external.push(new URL(r.url()).origin);});
      await page.goto(origin+'/?scenario=profile-correction#/pages/analysis/index',{waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready);
      const shot=async(name:string)=>{const path=`docs/media/profile-correction/${name}.png`;await page.screenshot({path:local(path),fullPage:true});screenshots.push({page:name,path});};
      await expect(page.getByText('已经认识你的商品',{exact:true})).toBeVisible();await expect(page.locator('textarea')).toHaveCount(0);
      await expect(page.getByRole('button',{name:'挑选一套方案',exact:true})).toBeVisible();await shot('01-no-required-form');
      checks.push('DEFAULT_SHARED_MINI_FLOW_NEEDS_NO_CORRECTION_FORM_OR_FIELD_CONFIRMATION');
      await page.getByRole('button',{name:'识别有误？补充一处纠错',exact:true}).click();
      await page.locator('textarea').fill('柚香泵头瓶 · 用户更名');await shot('02-optional-correction');
      await page.getByRole('button',{name:'保存这一处纠错',exact:true}).click();
      await expect(page.getByRole('button',{name:'核对原提交',exact:true})).toBeVisible();await expect(page.locator('textarea')).toHaveCount(0);await shot('03-original-intent-retry');
      await page.getByRole('button',{name:'核对原提交',exact:true}).click();await expect(page.getByText('柚香泵头瓶 · 用户更名',{exact:true})).toBeVisible();
      const replay=await page.evaluate(()=>(window as unknown as {__YPCC_CORRECTION_REPLAY__:{posts:{key:string;body:unknown}[]}}).__YPCC_CORRECTION_REPLAY__);
      expect(replay.posts).toHaveLength(2);expect(replay.posts[0]!.key).toBe(replay.posts[1]!.key);expect(replay.posts[0]!.body).toEqual(replay.posts[1]!.body);
      checks.push('LOST_SYNTHETIC_COMMIT_ACK_REPLAYS_THE_ORIGINAL_KEY_AND_BODY_THEN_REFRESHES_PROFILE');
      await page.getByRole('button',{name:'识别有误？补充一处纠错',exact:true}).click();await page.getByRole('button',{name:'标签文字',exact:true}).click();
      await page.locator('textarea').fill('演示标签上写着：清新日常');await page.getByRole('button',{name:'保存这一处纠错',exact:true}).click();
      await expect(page.getByText('请选择能看到这项内容的原照片',{exact:true})).toBeVisible();
      expect(await page.evaluate(()=>(window as unknown as {__YPCC_CORRECTION_REPLAY__:{posts:unknown[]}}).__YPCC_CORRECTION_REPLAY__.posts.length)).toBe(2);
      checks.push('PHOTO_EVIDENCE_IS_REQUIRED_FOR_VISIBLE_FEATURES_AND_LABEL_TEXT_BEFORE_SENDING');
      await page.getByRole('button',{name:'照片3 · 标签',exact:true}).click();await page.getByRole('button',{name:'保存这一处纠错',exact:true}).click();
      await expect(page.getByText('你的纠错（待复核）：演示标签上写着：清新日常',{exact:true})).toBeVisible();await shot('04-user-source-preserved');
      await expect(page.getByText('暂不能确认：成分与功效、未经核实的品牌和认证',{exact:true})).toBeVisible();
      checks.push('USER_CORRECTION_REMAINS_LABELLED_PENDING_REVIEW_AND_ORIGINAL_UNKNOWNS_REMAIN');
      await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await shot('05-narrow-screen');
      checks.push('NARROW_SCREEN_HAS_NO_HORIZONTAL_OVERFLOW_AND_RETAINS_OPTIONAL_FLOW');
      await page.getByRole('button',{name:'识别有误？补充一处纠错',exact:true}).click();await page.locator('textarea').fill('未提交的私人草稿');
      await page.getByRole('button',{name:'先不纠错',exact:true}).click();await page.getByRole('button',{name:'识别有误？补充一处纠错',exact:true}).click();
      await expect(page.locator('textarea')).toHaveValue('柚香泵头瓶 · 用户更名');
      const state=await context.storageState();expect(state.cookies).toHaveLength(0);expect(state.origins).toHaveLength(0);expect(await page.evaluate(()=>sessionStorage.length)).toBe(0);
      checks.push('CANCEL_DISCARDS_PRIVATE_FORM_WITHOUT_BROWSER_STORAGE_OR_COOKIE');
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
for(const path of [...screenshots.map(s=>s.path),...['walkthrough.webm','walkthrough.mp4','walkthrough.gif'].map(n=>`docs/media/profile-correction/${n}`)]){
  const bytes=await readFile(local(path));files.push({path,bytes:bytes.length,sha256:sha(bytes)});
}
if(report.source_set_hash!==(await snapshot()).source_set_hash)throw Error('Source changed during recording');
const sourceFiles=[];
for(const path of ['scripts/record-profile-correction.ts','src/shared/ui/analysis.tsx','src/shared/ui/profile-correction.tsx','src/shared/client/profile-correction.ts','src/shared/client/drafts.ts','src/api/modules/products.ts','src/preview/fixtures.ts']){
  const bytes=await readFile(local(path));sourceFiles.push({path,sha256:sha(bytes)});
}
await writeFile(resolve(output,'capture-manifest.json'),JSON.stringify({captured_at:new Date().toISOString(),type:'ACTUAL_BROWSER_RECORDING_SHARED_MINI_OPTIONAL_PROFILE_CORRECTION',
  data_source:'SYNTHETIC_PRODUCT_CORRECTIONS_AND_ACK_LOSS_ACTUAL_SHARED_UI_BROWSER_RENDERING',source_set_hash:report.source_set_hash,build_root:report.build_root,
  native_mini_device_verified:false,real_generation_verified:false,real_payment_verified:false,browser_tabs_closed:browserClosed,
  owned_preview_server_stopped:server.exitCode!==null||server.signalCode!==null,browser_errors:errors,external_network_requests:external,
  checks,screenshots,recording:inspection,files,source_files:sourceFiles},null,2)+'\n');
console.log(JSON.stringify({status:'PASS',checks:checks.length,screenshots:screenshots.length,media_files:files.length,recording:inspection.format,
  browser_closed:browserClosed,server_stopped:server.exitCode!==null||server.signalCode!==null,path:relative(process.cwd(),output)}));
