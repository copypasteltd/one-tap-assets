import {chromium,expect} from '@playwright/test';
import {spawn,execFileSync} from 'node:child_process';
import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
import {resolve,relative} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import './delivery/local-env.js';
import {local,sha,snapshot} from './delivery/common.js';

// Actual shared mini-program creator UI; synthetic author metadata, plus real native media from focused SAMPLE checks.
const report=JSON.parse(await readFile('docs/delivery/current.json','utf8')) as {build_root:string;source_set_hash:string;components:{name:string;status:string}[]};
if(report.source_set_hash!==(await snapshot()).source_set_hash||report.components.find(c=>c.name==='preview')?.status!=='PASS')throw new Error('Build the current preview before recording');
const output=local('docs/media/creative-components');await mkdir(output,{recursive:true});
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
      recordVideo:{dir:local('runtime/preview-recordings/creative-components'),size:{width:430,height:932}}});
    context.setDefaultTimeout(7000);
    try{
      const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
      page.on('requestfailed',r=>errors.push(`${r.method()} ${new URL(r.url()).pathname} ${r.failure()?.errorText}`));
      page.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith(origin+'/'))external.push(new URL(r.url()).origin);});
      await page.goto(origin+'/?scenario=creative-components#/pages/home/index',{waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready);
      const shot=async(name:string)=>{const path=`docs/media/creative-components/${name}.png`;await page.screenshot({path:local(path)});screenshots.push({page:name,path});};
      await page.evaluate(()=>{location.hash='/pages/draft/index';});
      await expect(page.getByText('从一种风格开始。',{exact:true})).toBeVisible();
      await page.getByPlaceholder('例如：午后小店的轻快日常').fill('柚子留白 · 细节开场');
      await page.locator('textarea').fill('合成作者演示：优先可见细节，固定观察，保持商品真实特征。');
      await page.getByPlaceholder('自然、轻快、日常').fill('留白、细节');await shot('01-creator-draft');
      for(const name of ['叙事顺序（可选）','镜头节奏（可选）','镜头运动（可选）','文字样式（可选）'])await expect(page.getByText(name,{exact:true})).toBeVisible();
      checks.push('FOUR_OPTIONAL_CREATIVE_GROUPS_IN_ACTUAL_SHARED_MINI_EDITOR');
      for(const name of ['先整体，再细节','细节开场','角度对照','均匀展开','轻快开场','从容收尾','固定观察','缓慢推进','轻柔横移','清晰标准','醒目强调','轻简留白'])await expect(page.getByRole('button',{name:new RegExp('^'+name)})).toBeEnabled();
      checks.push('TWELVE_TRUSTED_OPTIONS_AVAILABLE_WITHOUT_EXTRA_RESOURCE_UPLOAD');
      await page.getByRole('button',{name:/^细节开场/}).click();await page.getByRole('button',{name:/^轻快开场/}).click();
      await page.getByRole('button',{name:/^固定观察/}).click();await page.getByRole('button',{name:/^缓慢推进/}).click();
      await expect(page.getByRole('button',{name:/^缓慢推进 · 已选/})).toBeVisible();await expect(page.getByRole('button',{name:/^固定观察 · 已选/})).toHaveCount(0);
      await page.getByRole('button',{name:/^缓慢推进/}).click();await expect(page.getByRole('button',{name:/^缓慢推进 · 已选/})).toHaveCount(0);
      await page.getByRole('button',{name:/^固定观察/}).click();checks.push('RADIO_REPLACEMENT_AND_SECOND_TAP_RESTORES_INHERITANCE');
      await page.getByText('叙事顺序（可选）',{exact:true}).scrollIntoViewIfNeeded();await shot('02-narrative-and-rhythm');
      await page.getByRole('button',{name:/^醒目强调/}).click();await page.getByRole('button',{name:'保存方案',exact:true}).click();
      await expect(page.getByText('让这套方案，更像你。',{exact:true})).toBeVisible();
      for(const name of ['细节开场','轻快开场','固定观察','醒目强调'])await expect(page.getByRole('button',{name:new RegExp('^'+name+' · 已选')})).toBeVisible();
      expect(new URL(page.url()).hash).toContain('draft_id=demo_creative_draft');checks.push('SYNTHETIC_DRAFT_SAVE_AND_REOPEN_PRESERVES_ALL_FOUR_SELECTIONS');
      await page.getByText('文字样式（可选）',{exact:true}).scrollIntoViewIfNeeded();await shot('03-saved-text-style');
      await page.setViewportSize({width:320,height:800});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);checks.push('NO_HORIZONTAL_OVERFLOW_AT_320PX');
      await page.setViewportSize({width:430,height:932});
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
for(const name of ['photo-layout.png','photo_layout.mp4','per_shot_ai.mp4','reference_film.mp4'])await copyFile(local('runtime/test-results/creative-media/'+name),resolve(output,name));
for(const path of [...screenshots.map(s=>s.path),...['walkthrough.webm','walkthrough.mp4','walkthrough.gif','photo-layout.png','photo_layout.mp4','per_shot_ai.mp4','reference_film.mp4'].map(n=>`docs/media/creative-components/${n}`)]){
  const bytes=await readFile(local(path));files.push({path,bytes:bytes.length,sha256:sha(bytes)});
}
const sourceFiles=[];
for(const path of ['scripts/record-creative-components.ts','src/shared/ui/community.tsx','src/shared/domain/creative-components.ts','src/worker/compiler/community-direction.ts','src/worker/compiler/plan.ts','src/worker/generation/silent-video.ts','src/worker/media/community-captions.ts','src/preview/fixtures.ts']){
  const bytes=await readFile(local(path));sourceFiles.push({path,sha256:sha(bytes)});
}
await writeFile(resolve(output,'capture-manifest.json'),JSON.stringify({captured_at:new Date().toISOString(),type:'ACTUAL_BROWSER_RECORDING_SHARED_MINI_CREATIVE_COMPONENTS',
  data_source:'SYNTHETIC_CREATOR_METADATA_AND_MODELS_WITH_ACTUAL_POSTGRESQL_PNG_MP4_SAMPLE_PROOFS',source_set_hash:report.source_set_hash,build_root:report.build_root,
  native_mini_device_verified:false,real_generation_verified:false,real_payment_verified:false,browser_tabs_closed:browserClosed,
  owned_preview_server_stopped:server.exitCode!==null||server.signalCode!==null,browser_errors:errors,external_network_requests:external,
  checks,screenshots,recording:inspection,files,source_files:sourceFiles},null,2)+'\n');
console.log(JSON.stringify({status:'PASS',checks:checks.length,screenshots:screenshots.length,media_files:files.length,recording:inspection.format,
  browser_closed:browserClosed,server_stopped:server.exitCode!==null||server.signalCode!==null,path:relative(process.cwd(),output)}));
