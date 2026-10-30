import {chromium,expect} from '@playwright/test';
import {spawn,execFileSync} from 'node:child_process';
import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import './delivery/local-env.js';
import {local,sha,snapshot} from './delivery/common.js';
import {plusFixture} from '../tests/helpers/plus.js';
import {id} from '../src/api/lib/crypto.js';
import type {DTO} from '../src/shared/contracts/types.js';

// Actual compiled Plus UI + HTTP handlers + native PostgreSQL transactions.
// Host identity, payment, QA and the fixture PNG remain synthetic. Authoring
// does not invoke generation, Codex, sample production, rights or publication.
const report=JSON.parse(await readFile('docs/delivery/current.json','utf8')) as {build_root:string;source_set_hash:string;components:{name:string;status:string}[]};
if(report.source_set_hash!==(await snapshot()).source_set_hash||report.components.find(x=>x.name==='preview')?.status!=='PASS')throw new Error('Compile current sources before recording');
const output=local('docs/media/plus-presets');await mkdir(output,{recursive:true});
const f=await plusFixture(),port=4188,origin=`http://127.0.0.1:${port}`,shots:{path:string;label:string}[]=[],checks:string[]=[],errors:string[]=[];
const server=spawn(process.execPath,['--import','tsx','scripts/delivery/serve-preview.ts'],{cwd:process.cwd(),windowsHide:true,shell:false,stdio:'ignore',env:{...process.env,YPCC_PREVIEW_DIRECTORY:local(`${report.build_root}/preview`),YPCC_PREVIEW_PORT:String(port)}});
let videoPath:string|undefined,browserClosed=false,serverClosed=false,dropAcknowledgement=false,plusSessionId='';
const native=async(path:string,method:'GET'|'POST'|'PATCH'|'DELETE'='GET',body?:Record<string,unknown>)=>{
  const response=await f.app.inject({method,url:'/v1/p01'+path,headers:{authorization:`Bearer ${f.buyer.accessToken}`,'idempotency-key':id('recorderintent')},...(body===undefined?{}:{payload:body})});
  if(response.statusCode<200||response.statusCode>=300)throw new Error(`Native recorder preparation failed (${response.statusCode})`);return response.json().data;
};
try{
  let ready=false;for(let i=0;i<100;i++){if(server.exitCode!==null)throw new Error('Owned preview stopped');try{ready=(await fetch(origin,{signal:AbortSignal.timeout(1000)})).ok;}catch{}if(ready)break;await delay(250);}if(!ready)throw new Error('Owned preview did not become ready');
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try{
    const context=await browser.newContext({viewport:{width:1440,height:1040},locale:'zh-CN',recordVideo:{dir:local('runtime/preview-recordings/plus-presets'),size:{width:1440,height:1040}}});
    try{
      const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('dialog',dialog=>void dialog.accept());
      await page.route(origin+'/v1/p01/**',async route=>{
        const request=route.request(),url=new URL(request.url());
        const response=await f.app.inject({method:request.method() as 'GET'|'POST'|'PATCH'|'DELETE',url:url.pathname+url.search,headers:request.headers(),...(request.postData()?{payload:JSON.parse(request.postData()!)}:{})});
        if(dropAcknowledgement&&url.pathname==='/v1/p01/preset-drafts'&&request.method()==='POST'&&response.statusCode===201){dropAcknowledgement=false;await route.abort('connectionreset');return;}
        await route.fulfill({status:response.statusCode,contentType:'application/json',headers:{'cache-control':'no-store'},body:response.body});
      });
      const shot=async(name:string,label:string)=>{const path=`docs/media/plus-presets/${name}.png`;await page.screenshot({path:local(path),animations:'disabled'});shots.push({path,label});};
      await page.goto(origin+'/plus.html',{waitUntil:'networkidle'});await page.getByRole('checkbox',{name:'允许编排社区预设草稿（需作者原账号确认，样例与发布回手机）',exact:true}).check();
      await shot('01-explicit-authoring-request','Plus 单独申请原账号预设编排权限');
      await page.getByRole('button',{name:'生成接续码',exact:true}).click();const code=(await page.getByLabel('电脑接续码').innerText()).replaceAll(' ','');
      const inspection=await native('/plus/links/inspect','POST',{user_code:code});if(inspection.can_edit_community_drafts!==true)throw new Error('Explicit scope missing');
      await native('/plus/links/decision','POST',{user_code:code,decision:'APPROVE'});await page.getByRole('button',{name:'预设编排',exact:true}).click({timeout:20000});
      await expect(page.getByRole('heading',{name:'把灵感，排成一套方案。',exact:true})).toBeVisible();plusSessionId=(await native('/plus/sessions')).items.find((s:DTO<'PlusSessionInfo'>)=>s.can_edit_community_drafts)?.session_id;if(!plusSessionId)throw new Error('Creator session not issued');
      await page.getByLabel('方案名称',{exact:true}).fill('午后小店的轻快日常');await page.getByLabel('创作说明',{exact:true}).fill('先看商品整体，再展现可见细节，以轻快节奏呈现日常小店的自然气息。');await page.getByLabel('风格标签',{exact:true}).fill('自然、轻快、日常');
      await page.locator('.preset-option').filter({has:page.getByText('先整体，再细节',{exact:true})}).click();await page.locator('.preset-option').filter({has:page.getByText('轻快开场',{exact:true})}).click();
      const specifications=page.locator('.preset-panel').filter({has:page.getByRole('heading',{name:'07 · 制作规格',exact:true})});await specifications.locator('.preset-option').filter({hasText:'原照片制作'}).nth(1).click();
      await page.getByRole('heading',{name:'把灵感，排成一套方案。',exact:true}).scrollIntoViewIfNeeded();await shot('02-composition-and-checks','组合主风格、方向和多规格；侧栏核对清单');
      dropAcknowledgement=true;await page.getByRole('button',{name:'保存云端草稿',exact:true}).click();await expect(page.getByRole('button',{name:'核对原次保存',exact:true})).toBeVisible();await shot('03-save-acknowledgement-unknown','真实事务已提交，模拟回执丢失后保留原意图');
      await page.getByRole('button',{name:'核对原次保存',exact:true}).click();await expect(page.getByRole('status')).toContainText('已保存到云端');
      const list:DTO<'PresetDraftList'>=await native('/preset-drafts');if(list.items.length!==1)throw new Error('Original request replay created duplicate drafts');const draft=list.items[0]!;checks.push('EXPLICIT_NATIVE_SCOPE_AND_ORIGINAL_INTENT_REPLAY_CREATE_ONE_CLOUD_DRAFT');
      await page.getByRole('heading',{name:'把灵感，排成一套方案。',exact:true}).scrollIntoViewIfNeeded();await shot('04-cloud-saved','云端草稿可由原账号小程序继续');
      await page.getByLabel('方案名称',{exact:true}).fill('午后小店的轻快日常 · 电脑续编');
      await native(`/preset-drafts/${draft.draft_id}`,'PATCH',{expected_revision:draft.revision,config:{...draft.config,name:'手机更新的方案名字'}});
      await page.getByRole('button',{name:'保存云端草稿',exact:true}).click();await expect(page.getByRole('button',{name:'保留当前修改继续',exact:true})).toBeVisible();await shot('05-revision-conflict','手机与电脑同时修改时保留当前内容并明确比较');
      await page.getByRole('button',{name:'保留当前修改继续',exact:true}).click();await page.getByRole('button',{name:'保存云端草稿',exact:true}).click();await expect(page.getByRole('status')).toContainText('修订 2');checks.push('REAL_PHONE_UPDATE_CONFLICT_PRESERVES_LOCAL_EDITS_AND_REQUIRES_EXPLICIT_CHOICE');
      await page.getByRole('button',{name:'返回素材工作台',exact:true}).click();await page.getByRole('button',{name:'预设编排',exact:true}).click();await page.locator('.preset-drafts .plus-source-row').filter({hasText:'午后小店的轻快日常 · 电脑续编'}).click();await expect(page.getByLabel('方案名称',{exact:true})).toHaveValue('午后小店的轻快日常 · 电脑续编');checks.push('SAVED_DRAFT_REOPENS_FROM_OWN_CLOUD_LIST');
      await page.setViewportSize({width:430,height:932});await page.evaluate(()=>window.scrollTo(0,0));await shot('06-narrow-viewport','窄屏布局与同一份云端草稿');
      await page.setViewportSize({width:1440,height:1040});await native(`/plus/sessions/${plusSessionId}`,'DELETE');await page.locator('.preset-drafts .plus-source-row').filter({hasText:'午后小店的轻快日常 · 电脑续编'}).click();await expect(page.getByRole('button',{name:'生成接续码',exact:true})).toBeVisible();await expect(page.getByRole('alert')).toContainText('电脑连接已关闭或到期');await shot('07-native-revocation','手机关闭连接后下一请求失效并清空工作台');checks.push('NATIVE_REVOCATION_CLOSES_EXISTING_CREATOR_WORKSPACE_ON_NEXT_REQUEST');
      const recording=page.video();await page.close();videoPath=await recording?.path();
    }finally{await context.close();}
  }finally{await browser.close();browserClosed=true;}
}finally{
  if(server.exitCode===null&&server.signalCode===null){try{execFileSync('taskkill.exe',['/PID',String(server.pid),'/T','/F'],{windowsHide:true,stdio:'ignore',timeout:10000});}catch{server.kill();}}
  if(server.exitCode===null&&server.signalCode===null)await Promise.race([new Promise<void>(done=>server.once('close',()=>done())),delay(5000)]);
  serverClosed=server.exitCode!==null||server.signalCode!==null;await f.close();
}
if(errors.length||!videoPath||!browserClosed||!serverClosed)throw new Error(JSON.stringify({browser_errors:errors,browserClosed,serverClosed,recorded:!!videoPath}));
await copyFile(videoPath,resolve(output,'walkthrough.webm'));
const ffmpeg=process.env.FFMPEG_PATH?.trim()||'ffmpeg',ffprobe=process.env.FFPROBE_PATH?.trim()||'ffprobe';
const run=(args:string[])=>execFileSync(ffmpeg,['-hide_banner','-loglevel','error','-y',...args],{windowsHide:true,timeout:90000,maxBuffer:2000000});
run(['-i',videoPath,'-an','-c:v','libx264','-crf','27','-pix_fmt','yuv420p','-movflags','+faststart',resolve(output,'walkthrough.mp4')]);
run(['-i',videoPath,'-vf','fps=4,scale=640:-2:flags=lanczos,split[a][b];[a]palettegen=max_colors=80[p];[b][p]paletteuse=dither=bayer:bayer_scale=3','-loop','0',resolve(output,'walkthrough.gif')]);
const media=[];for(const path of [...shots.map(shot=>shot.path),'docs/media/plus-presets/walkthrough.webm','docs/media/plus-presets/walkthrough.mp4','docs/media/plus-presets/walkthrough.gif']){const bytes=await readFile(path);media.push({path,bytes:bytes.length,sha256:sha(bytes)});}
const probe=JSON.parse(execFileSync(ffprobe,['-v','error','-show_entries','format=duration:stream=codec_name,width,height','-of','json',resolve(output,'walkthrough.mp4')],{windowsHide:true,timeout:10000,encoding:'utf8'}));
await writeFile(resolve(output,'manifest.json'),JSON.stringify({checked_at:new Date().toISOString(),source_set_hash:report.source_set_hash,classification:'ACTUAL_COMPILED_PLUS_UI_NATIVE_HTTP_AND_POSTGRESQL_WITH_SYNTHETIC_NATIVE_IDENTITY',checks,shots,media,video_probe:probe,browser_errors:errors,browser_closed:browserClosed,owned_tabs_closed:true,owned_preview_server_closed:serverClosed,temporary_schema_removed:true,full_suite_run:false,actual_platform_login_verified:false,production_admitted:false,cloud_deployed:false},null,2)+'\n');
console.log(JSON.stringify({recorded:true,screenshots:shots.length,checks:checks.length,browser_closed:browserClosed,owned_preview_server_closed:serverClosed,manifest:'docs/media/plus-presets/manifest.json'}));
