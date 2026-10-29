import {chromium,expect} from '@playwright/test';
import {spawn,execFileSync} from 'node:child_process';
import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
import {resolve,relative} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import './delivery/local-env.js';
import {local,sha} from './delivery/common.js';

// Supplemental recording of actual shared draft/resume UI with synthetic browser metadata.
const report=JSON.parse(await readFile('docs/delivery/current.json','utf8')) as {build_root:string;source_set_hash:string;components:{name:string;status:string}[]};
if(report.components.find(c=>c.name==='preview')?.status!=='PASS')throw new Error('Build the current preview before recording');
const output=local('docs/media/draft-resume');await mkdir(output,{recursive:true});
const port=4175,origin=`http://127.0.0.1:${port}`,screenshots:{page:string;path:string}[]=[],checks:string[]=[],errors:string[]=[],external:string[]=[];
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
      recordVideo:{dir:local('runtime/preview-recordings/draft-resume'),size:{width:430,height:932}}});
    context.setDefaultTimeout(7000);
    try{
      const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
      page.on('requestfailed',r=>errors.push(`${r.method()} ${new URL(r.url()).pathname} ${r.failure()?.errorText}`));
      page.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith(origin+'/'))external.push(new URL(r.url()).origin);});
      await page.goto(origin+'/?scenario=draft-resume#/pages/home/index',{waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready);
      const scene=page.getByLabel('演示场景');
      const shot=async(name:string)=>{await page.evaluate(()=>window.scrollTo(0,0));await page.waitForTimeout(200);
        const path=`docs/media/draft-resume/${name}.png`;await page.screenshot({path:local(path)});screenshots.push({page:name,path});};
      await expect(page.getByRole('button',{name:'继续上次草稿',exact:true})).toBeVisible();await shot('01-resume-home');checks.push('HOME_READS_LIVE_OWNED_DRAFT');
      await page.getByRole('button',{name:'继续上次草稿',exact:true}).click();
      await expect(page.getByText('确认这一套素材',{exact:true})).toBeVisible();await shot('02-original-plan');checks.push('RESUME_OPENS_ORIGINAL_MATCHING_PLAN');
      await scene.selectOption('library');await expect(page.getByText('商品草稿 1',{exact:true})).toBeVisible();
      await expect(page.getByText('商品信息已整理',{exact:true})).toBeVisible();await shot('03-server-drafts');checks.push('LIBRARY_LISTS_SERVER_DRAFTS');
      await page.getByRole('button',{name:'继续选择或制作方案',exact:true}).click();
      await expect(page.getByText('确认这一套素材',{exact:true})).toBeVisible();checks.push('DRAFT_LIST_CONTINUES_EXISTING_PLAN');
      await scene.selectOption('analysis');await expect(page.getByText('瓶身：透明琥珀色',{exact:true})).toBeVisible();
      await expect(page.getByText('结构：白色按压泵头',{exact:true})).toBeVisible();checks.push('OBSERVED_FEATURES_ARE_DISPLAYED');
      await expect(page.getByText('继续已选方案',{exact:true})).toBeVisible();
      await expect(page.getByRole('button',{name:'用已选方案继续制作',exact:true})).toBeDisabled();
      await shot('04-selected-spec');checks.push('RESTORED_SPEC_REMAINS_UNAVAILABLE_WHEN_NOT_ADMITTED');
      await page.getByRole('button',{name:'查看原方案规格',exact:true}).click();
      expect(new URLSearchParams(new URL(page.url()).hash.split('?')[1]).get('variant_id')).toBeTruthy();
      await expect(page.getByText('这一套，将为你制作',{exact:true})).toBeVisible();checks.push('ORIGINAL_SPEC_REFERENCE_IS_INCLUDED_IN_NAVIGATION');
      await page.setViewportSize({width:320,height:800});await scene.selectOption('analysis');
      await expect(page.getByText('继续已选方案',{exact:true})).toBeVisible();
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);checks.push('NO_HORIZONTAL_OVERFLOW_AT_320PX');
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
for(const path of [...screenshots.map(s=>s.path),...['walkthrough.webm','walkthrough.mp4','walkthrough.gif'].map(n=>`docs/media/draft-resume/${n}`)]){
  const bytes=await readFile(local(path));files.push({path,bytes:bytes.length,sha256:sha(bytes)});
}
const sourceFiles=[];
for(const path of ['scripts/record-draft-resume.ts','src/shared/ui/pages.tsx','src/shared/ui/analysis.tsx','src/shared/ui/drafts.tsx','src/shared/client/drafts.ts','src/shared/client/preset-selection.ts','src/shared/client/session.ts','src/preview/fixtures.ts']){
  const bytes=await readFile(local(path));sourceFiles.push({path,sha256:sha(bytes)});
}
await writeFile(resolve(output,'capture-manifest.json'),JSON.stringify({captured_at:new Date().toISOString(),type:'ACTUAL_BROWSER_RECORDING_SHARED_MINI_DRAFT_RESUME',
  data_source:'SYNTHETIC_PROFILE_DRAFT_PLAN_AND_UNAVAILABLE_OFFICIAL_SPEC',source_set_hash:report.source_set_hash,build_root:report.build_root,
  native_mini_device_verified:false,real_generation_verified:false,real_payment_verified:false,browser_tabs_closed:browserClosed,
  owned_preview_server_stopped:server.exitCode!==null||server.signalCode!==null,browser_errors:errors,external_network_requests:external,
  checks,screenshots,recording:inspection,files,source_files:sourceFiles},null,2)+'\n');
console.log(JSON.stringify({status:'PASS',checks:checks.length,screenshots:screenshots.length,media_files:files.length,recording:inspection.format,
  browser_closed:browserClosed,server_stopped:server.exitCode!==null||server.signalCode!==null,path:relative(process.cwd(),output)}));
