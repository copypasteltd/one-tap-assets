import {chromium,expect} from '@playwright/test';
import {spawn,execFileSync} from 'node:child_process';
import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
import {resolve,relative} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import './delivery/local-env.js';
import {local,sha,snapshot} from './delivery/common.js';

// Actual shared mini-program buyer UI. All product, ranking and availability metadata in this recording are synthetic.
const report=JSON.parse(await readFile('docs/delivery/current.json','utf8')) as {build_root:string;source_set_hash:string;components:{name:string;status:string}[]};
if(report.source_set_hash!==(await snapshot()).source_set_hash||report.components.find(c=>c.name==='preview')?.status!=='PASS')throw new Error('Build the current preview before recording');
const output=local('docs/media/recommendations');await mkdir(output,{recursive:true});
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
      recordVideo:{dir:local('runtime/preview-recordings/recommendations'),size:{width:430,height:932}}});
    context.setDefaultTimeout(7000);
    try{
      const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
      page.on('requestfailed',r=>errors.push(`${r.method()} ${new URL(r.url()).pathname} ${r.failure()?.errorText}`));
      page.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith(origin+'/'))external.push(new URL(r.url()).origin);});
      await page.goto(origin+'/?scenario=recommendations#/pages/analysis/index',{waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready);
      const shot=async(name:string)=>{const path=`docs/media/recommendations/${name}.png`;await page.screenshot({path:local(path)});screenshots.push({page:name,path});};
      await expect(page.getByText('适合这件商品的方案',{exact:true})).toBeVisible();
      for(const text of ['当前商品类别适合明亮轻盈的日常风格。','照片已确认结构细节，适合用信息卡片逐项展示。','照片已确认可见配色，可以用色块突出商品原色。'])await expect(page.getByText(text,{exact:true})).toBeVisible();
      await page.getByText('适合这件商品的方案',{exact:true}).scrollIntoViewIfNeeded();await shot('01-product-recommendations');
      checks.push('ACTUAL_SHARED_ANALYSIS_DISPLAYS_THREE_SYNTHETIC_REASONS_AND_VARIANT_COUNTS');
      await page.getByRole('button',{name:'查看方案与适配规格',exact:true}).first().click();
      expect(new URL(page.url()).hash).toContain('preset_id=fresh-daily');expect(new URL(page.url()).hash).toContain('version=3.1.0');expect(new URL(page.url()).hash).toContain('variant_id=fresh-daily.photo-layout');
      await expect(page.getByText('这套方案还在准备中，开放后可拍照制作。',{exact:true})).toBeVisible();await shot('02-exact-version-recheck');
      checks.push('EXACT_VERSION_AND_RECOMMENDED_VARIANT_PRESERVED_DETAIL_RECHECKS_SYNTHETIC_WITHDRAWAL');
      await page.goto(origin+'/?scenario=recommendations#/pages/analysis/index',{waitUntil:'networkidle'});
      await page.getByRole('button',{name:'挑选一套方案',exact:true}).click();await expect(page.locator('.preset-card')).toHaveCount(10);
      checks.push('BUYER_CAN_BROWSE_ALL_TEN_STYLES_WITHOUT_AUTOMATIC_SELECTION');
      await page.goto(origin+'/?scenario=recommendations-empty#/pages/analysis/index',{waitUntil:'networkidle'});
      await expect(page.getByText('当前没有已开放且适合这些照片的方案。可以先浏览风格，或补拍清晰细节后重新识别。',{exact:true})).toBeVisible();
      await expect(page.getByRole('button',{name:'重新拍照',exact:true})).toBeVisible();await shot('03-empty-recommendations');
      checks.push('EMPTY_LIST_OFFERS_CATALOG_AND_RECAPTURE_WITHOUT_REQUIRED_FORM');
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
for(const path of [...screenshots.map(s=>s.path),...['walkthrough.webm','walkthrough.mp4','walkthrough.gif'].map(n=>`docs/media/recommendations/${n}`)]){
  const bytes=await readFile(local(path));files.push({path,bytes:bytes.length,sha256:sha(bytes)});
}
const sourceFiles=[];
for(const path of ['scripts/record-recommendations.ts','src/shared/ui/analysis.tsx','src/shared/ui/recommendations.tsx','src/shared/client/recommendations.ts','src/shared/domain/recommendations.ts','src/api/modules/recommendations.ts','src/preview/fixtures.ts']){
  const bytes=await readFile(local(path));sourceFiles.push({path,sha256:sha(bytes)});
}
await writeFile(resolve(output,'capture-manifest.json'),JSON.stringify({captured_at:new Date().toISOString(),type:'ACTUAL_BROWSER_RECORDING_SHARED_MINI_PRODUCT_RECOMMENDATIONS',
  data_source:'SYNTHETIC_PRODUCT_RECOMMENDATIONS_AND_WITHDRAWAL_METADATA_ACTUAL_BROWSER_RENDERING',source_set_hash:report.source_set_hash,build_root:report.build_root,
  native_mini_device_verified:false,real_generation_verified:false,real_payment_verified:false,browser_tabs_closed:browserClosed,
  owned_preview_server_stopped:server.exitCode!==null||server.signalCode!==null,browser_errors:errors,external_network_requests:external,
  checks,screenshots,recording:inspection,files,source_files:sourceFiles},null,2)+'\n');
console.log(JSON.stringify({status:'PASS',checks:checks.length,screenshots:screenshots.length,media_files:files.length,recording:inspection.format,
  browser_closed:browserClosed,server_stopped:server.exitCode!==null||server.signalCode!==null,path:relative(process.cwd(),output)}));
