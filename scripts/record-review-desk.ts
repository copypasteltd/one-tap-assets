import {chromium,expect} from '@playwright/test';
import {execFileSync} from 'node:child_process';
import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import './delivery/local-env.js';
import {local,sha,snapshot} from './delivery/common.js';
import {reviewDeskEnvironment} from '../tests/helpers/review-desk.js';
const build=JSON.parse(await readFile('docs/delivery/current.json','utf8')),source=await snapshot();
if(source.source_set_hash!==build.source_set_hash||build.components.find((c:{name:string})=>c.name==='preview')?.status!=='PASS')throw Error('Build current review UI first');
process.env.YPCC_BUILD_ROOT=local(build.build_root);
const output=local('docs/media/review-desk');await mkdir(output,{recursive:true});
const env=await reviewDeskEnvironment(),checks:string[]=[],errors:string[]=[],external:string[]=[],screenshots:{page:string;path:string}[]=[],posts:{key:string;body:string}[]=[];
let browserClosed=false,appClosed=false,videoPath:string|undefined;
try{
  const origin=await env.app.listen({host:'127.0.0.1',port:0}),browser=await chromium.launch({channel:'msedge',headless:true});
  try{
    const context=await browser.newContext({viewport:{width:1280,height:1040},deviceScaleFactor:1,locale:'zh-CN',colorScheme:'light',recordVideo:{dir:local('runtime/preview-recordings/review-desk'),size:{width:1280,height:1040}}});context.setDefaultTimeout(12000);
    try{
      const page=await context.newPage();let lose=true;
      page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith(origin+'/'))external.push(new URL(r.url()).origin);});
      await page.route('**/publications/*/review-decisions',async route=>{posts.push({key:route.request().headers()['idempotency-key']!,body:route.request().postData()!});const response=await route.fetch();
        if(lose){lose=false;await route.abort('failed');}else await route.fulfill({response});});
      const shot=async(name:string)=>{const path=`docs/media/review-desk/${name}.png`;await page.screenshot({path:local(path)});screenshots.push({page:name,path});};
      await page.goto(origin+'/ops/review',{waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready);await shot('01-independent-review-login');
      await expect(page.getByRole('button',{name:'连接审核工作台',exact:true})).toBeDisabled();checks.push('PUBLIC_SHELL_NO_PRIVATE_DATA_WITHOUT_INDEPENDENT_MANAGEMENT_TOKEN');
      await page.getByPlaceholder('输入分配给你的审核令牌').fill(env.token);await page.getByRole('button',{name:'连接审核工作台',exact:true}).click();
      await page.getByRole('button').filter({hasText:env.publication.publication_id}).click();await expect(page.getByRole('heading',{name:'柚子留白 · 商品展示',exact:true})).toBeVisible();
      await expect(page.getByRole('button',{name:'批准内容与权利',exact:true})).toBeDisabled();checks.push('NATIVE_DATABASE_QUEUE_ORIGINAL_CONFIG_AND_UNREVIEWED_APPROVAL_DISABLED');
      await page.getByRole('button',{name:'查看图片 1',exact:true}).click();const image=page.getByAltText('样例图片 1');await expect(image).toBeVisible();expect(await image.evaluate((node:HTMLImageElement)=>node.complete&&node.naturalWidth===640)).toBe(true);
      await shot('02-private-sample-and-evidence');await page.getByRole('button',{name:'关闭预览并释放文件',exact:true}).click();
      await page.getByRole('button',{name:'播放视频 2',exact:true}).click();await expect(page.locator('video')).toBeVisible();await expect.poll(()=>page.locator('video').evaluate((node:HTMLVideoElement)=>node.videoWidth)).toBe(360);
      await page.getByRole('button',{name:'关闭预览并释放文件',exact:true}).click();checks.push('ORIGINAL_AUTHENTICATED_PNG_AND_MP4_HASH_VERIFICATION_AND_BROWSER_DECODE');
      for(let index=0;index<2;index++){await page.getByRole('button',{name:'查看证明 1',exact:true}).first().click();await expect(page.getByAltText('授权证明 1')).toBeVisible();
        await page.getByRole('button',{name:'关闭预览并释放文件',exact:true}).click();await page.getByRole('checkbox').nth(index).check();}
      await page.getByPlaceholder('写清核对结论或需要作者补充的具体内容').fill('合成演示资料已逐项核对，仅验证审核流程，不代表商业或生产准入。');
      await page.getByRole('button',{name:'批准内容与权利',exact:true}).click();await expect(page.getByRole('button',{name:'继续确认原操作',exact:true})).toBeEnabled();await shot('03-original-review-pending');
      await page.getByRole('button',{name:'继续确认原操作',exact:true}).click();await expect(page.getByText(/已批准，待发布 · 申请版本/)).toBeVisible();expect(posts).toHaveLength(2);expect(posts[0]).toEqual(posts[1]);checks.push('COMMITTED_REVIEW_ACK_LOSS_REUSES_ONE_ORIGINAL_KEY_BODY_AND_REVISION');
      await env.prepare();await page.getByRole('button',{name:'刷新申请',exact:true}).click();await expect(page.getByText('独立公开样例已准备，可发布方案。',{exact:true})).toBeVisible();
      await page.getByPlaceholder('写清核对结论或需要作者补充的具体内容').fill('发布合成社区方案。平台价格、制作能力准入和开售继续独立。');await page.getByRole('button',{name:'发布到社区',exact:true}).click();
      await expect(page.getByText(/已发布 · 申请版本/)).toBeVisible();expect((await env.db.pool.query('SELECT data FROM publications WHERE id=$1',[env.publication.publication_id])).rows[0].data.sale_enabled).toBe(false);
      await page.getByRole('heading',{name:'柚子留白 · 商品展示',exact:true}).scrollIntoViewIfNeeded();await shot('04-independent-publication-without-sale');checks.push('ACTUAL_PUBLIC_SAMPLE_COPY_AND_PUBLICATION_KEEP_COMMERCIAL_SALE_DISABLED');
      expect(await page.evaluate(()=>({local:localStorage.length,session:sessionStorage.length}))).toEqual({local:0,session:0});await page.setViewportSize({width:360,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);checks.push('NO_CREDENTIAL_STORAGE_AND_NO_HORIZONTAL_OVERFLOW_AT_360PX');
      await page.getByRole('button',{name:'退出并清空',exact:true}).click();await expect(page.getByPlaceholder('输入分配给你的审核令牌')).toHaveValue('');await expect(page.getByRole('heading',{name:'柚子留白 · 商品展示',exact:true})).toHaveCount(0);checks.push('LOGOUT_RELEASES_BLOB_FILES_PRIVATE_DETAIL_AND_CONNECTION');
      const recording=page.video();await page.close();videoPath=await recording?.path();
    }finally{await context.close();}
  }finally{await browser.close();browserClosed=true;}
}finally{await env.close();appClosed=true;}
if(errors.length||external.length)throw Error(JSON.stringify({errors,external}));if(!videoPath)throw Error('Missing actual review browser recording');
await copyFile(videoPath,resolve(output,'walkthrough.webm'));
const ffmpeg=process.env.FFMPEG_PATH?.trim()||'ffmpeg',ffprobe=process.env.FFPROBE_PATH?.trim()||'ffprobe';
const run=(args:string[])=>execFileSync(ffmpeg,['-hide_banner','-loglevel','error','-y',...args],{windowsHide:true,timeout:60000,maxBuffer:2000000});
run(['-i',videoPath,'-an','-c:v','libx264','-crf','27','-pix_fmt','yuv420p','-movflags','+faststart',resolve(output,'walkthrough.mp4')]);
run(['-i',videoPath,'-vf','fps=4,scale=620:-2:flags=lanczos,split[a][b];[a]palettegen=max_colors=80[p];[b][p]paletteuse=dither=bayer:bayer_scale=3','-loop','0',resolve(output,'walkthrough.gif')]);
const inspection=JSON.parse(execFileSync(ffprobe,['-v','error','-show_entries','format=duration:stream=codec_name,width,height','-of','json',resolve(output,'walkthrough.mp4')],{windowsHide:true,encoding:'utf8',timeout:10000}));
const files=[];for(const path of [...screenshots.map(s=>s.path),...['walkthrough.webm','walkthrough.mp4','walkthrough.gif'].map(n=>`docs/media/review-desk/${n}`)]){const bytes=await readFile(local(path));files.push({path,bytes:bytes.length,sha256:sha(bytes)});}
await writeFile(resolve(output,'capture-manifest.json'),JSON.stringify({captured_at:new Date().toISOString(),type:'ACTUAL_REVIEW_UI_NATIVE_HTTP_DATABASE_AND_FILES',
 data_source:'SYNTHETIC_AUTHOR_RIGHTS_READY_QC_AND_OPERATOR_IDENTITY_ACTUAL_NATIVE_UPLOAD_PNG_MP4_REVIEW_COPY_PUBLICATION',source_set_hash:build.source_set_hash,build_root:build.build_root,
 native_mini_device_verified:false,real_generation_verified:false,real_payment_verified:false,production_staff_identity_verified:false,production_admitted:false,
 browser_tabs_closed:browserClosed,owned_api_and_database_pool_closed:appClosed,browser_errors:errors,external_network_requests:external,
 checks,screenshots,recording:inspection,files,original_review_mutating_requests:posts.length},null,2)+'\n');
console.log(JSON.stringify({status:'PASS',checks:checks.length,screenshots:screenshots.length,media_files:files.length,browser_closed:browserClosed,owned_api_closed:appClosed}));
