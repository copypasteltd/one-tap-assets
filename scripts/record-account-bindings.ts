import {chromium,expect} from '@playwright/test';
import {spawn,execFileSync} from 'node:child_process';
import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import './delivery/local-env.js';
import {local,sha,snapshot} from './delivery/common.js';
import {plusFixture} from '../tests/helpers/plus.js';
import {issueSession} from '../src/api/modules/identity.js';
import {id} from '../src/api/lib/crypto.js';
import type {WireRequest,WireResponse} from '../src/shared/client/api.js';

// Real shared UI + native HTTP handlers + temporary PostgreSQL schema.
// Login identities, paid order/QA and PNG are synthetic. This is not a device,
// actual host login, payment, album-save, Codex/provider or cloud acceptance.
const report=JSON.parse(await readFile('docs/delivery/current.json','utf8')) as {build_root:string;source_set_hash:string;components:{name:string;status:string}[]};
if(report.source_set_hash!==(await snapshot()).source_set_hash||report.components.find(c=>c.name==='preview')?.status!=='PASS')throw new Error('Build current sources before recording');
const output=local('docs/media/account-bindings');await mkdir(output,{recursive:true});
const f=await plusFixture(),peer=await issueSession(f.db.pool,{platform:'douyin',appId:'dev-douyin',subjectId:id('recordpeer')});
const port=4187,origin=`http://127.0.0.1:${port}`,shots:{path:string;label:string}[]=[],checks:string[]=[],errors:string[]=[];
const server=spawn(process.execPath,['--import','tsx','scripts/delivery/serve-preview.ts'],{cwd:process.cwd(),windowsHide:true,shell:false,stdio:'ignore',env:{...process.env,YPCC_PREVIEW_DIRECTORY:local(`${report.build_root}/preview`),YPCC_PREVIEW_PORT:String(port)}});
let videoPath:string|undefined,browserClosed=false,serverClosed=false;
async function bridge(request:WireRequest,nativeToken?:string):Promise<WireResponse>{
  const url=new URL(request.url);if(!url.pathname.startsWith('/v1/p01/'))throw new Error('Replay accepts business API paths only');
  const headers={...request.headers};if(headers.Authorization==='Bearer synthetic-browser-only')headers.Authorization=`Bearer ${nativeToken}`;
  const result=await f.app.inject({method:request.method as 'GET'|'POST'|'PUT'|'DELETE',url:url.pathname+url.search,headers,...(request.body!==undefined?{payload:JSON.parse(String(request.body))}:{})});
  return{status:result.statusCode,headers:Object.fromEntries(Object.entries(result.headers).filter(([,value])=>typeof value==='string')) as Record<string,string>,data:result.json()};
}
try{
  let ready=false;for(let i=0;i<60;i++){
    if(server.exitCode!==null)throw new Error('Owned replay service stopped');
    try{ready=(await fetch(origin,{signal:AbortSignal.timeout(1000)})).ok;}catch{}
    if(ready)break;await delay(250);
  }if(!ready)throw new Error('Owned replay service did not become ready');
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try{
    const aContext=await browser.newContext({viewport:{width:430,height:932},locale:'zh-CN'});
    const bContext=await browser.newContext({viewport:{width:390,height:844},locale:'zh-CN',recordVideo:{dir:local('runtime/preview-recordings/account-bindings'),size:{width:390,height:844}}});
    try{
      const a=await aContext.newPage(),b=await bContext.newPage();
      for(const page of [a,b]){page.setDefaultTimeout(10000);page.on('dialog',dialog=>void dialog.accept());page.on('pageerror',error=>errors.push(error.message));}
      await a.exposeFunction('__YPCC_ACCOUNT_BINDING_TRANSPORT__',(request:WireRequest)=>bridge(request,f.buyer.accessToken));
      await b.exposeFunction('__YPCC_ACCOUNT_BINDING_TRANSPORT__',(request:WireRequest)=>bridge(request,peer.access_token));
      const shot=async(page:typeof a,name:string,label:string)=>{const path=`docs/media/account-bindings/${name}.png`;await page.screenshot({path:local(path),fullPage:true});shots.push({path,label});};
      await a.goto(origin+'/?scenario=account-bindings#/pages/settings/index',{waitUntil:'networkidle'});await a.evaluate(()=>document.fonts.ready);
      await a.getByRole('button',{name:'绑定支付宝与抖音账号',exact:true}).click();await a.getByRole('button',{name:'本端发起绑定',exact:true}).click();
      await expect(a.locator('.price')).toHaveCount(1);const invite=(await a.locator('.price').textContent())!.trim();await shot(a,'01-origin-invite','发起端五分钟邀请');
      await b.goto(origin+'/?scenario=account-bindings#/pages/settings/index',{waitUntil:'networkidle'});await b.evaluate(()=>document.fonts.ready);
      await b.getByRole('button',{name:'绑定支付宝与抖音账号',exact:true}).click();await b.getByLabel('另一端绑定码').fill(invite);await b.getByRole('button',{name:'查看另一端邀请',exact:true}).click();
      await b.getByRole('button',{name:'我是本人，加入绑定',exact:true}).click();await expect(b.getByText('请亲自核对两端显示的确认码。由发起端完成最后确认。',{exact:true})).toBeVisible();await shot(b,'02-peer-proof','另一端主动加入，尚未共享');
      await a.getByRole('button',{name:'刷新绑定进度',exact:true}).click();await a.getByRole('button',{name:'两端一致，完成绑定',exact:true}).click();await expect(a.getByText('抖音 · 已绑定',{exact:true})).toBeVisible();await shot(a,'03-mutual-confirmation','发起端核对后完成绑定');checks.push('TWO_NATIVE_FIXTURE_IDENTITIES_REQUIRED_ORIGIN_CONFIRMATION_IN_ACTUAL_SHARED_UI');
      await b.goto(origin+'/?scenario=account-bindings#/pages/library/index',{waitUntil:'networkidle'});await b.getByRole('button',{name:'查看已绑定端作品',exact:true}).click();await b.getByRole('button',{name:'打开支付宝作品',exact:true}).click();
      await b.getByRole('button',{name:'查看另一端素材包',exact:true}).click();await expect(b.getByRole('button',{name:'保存这份素材到相册',exact:true})).toBeVisible();await shot(b,'04-bound-projects','另一端作品和真实清单读取');
      expect(await b.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);checks.push('BOUND_SOURCE_LIBRARY_AND_DELIVERABLES_RENDER_FROM_REAL_HTTP_HANDLERS_NO_HORIZONTAL_OVERFLOW');
      await b.getByRole('button',{name:'关闭另一端作品',exact:true}).click();
      const web=await aContext.newPage();web.setDefaultTimeout(10000);web.on('pageerror',error=>errors.push(error.message));
      await aContext.route(origin+'/v1/p01/**',async route=>{
        const request=route.request(),headers={'access-control-allow-origin':origin,'access-control-allow-methods':'GET,POST,PUT,DELETE,OPTIONS','access-control-allow-headers':'authorization,content-type,idempotency-key'};
        if(request.method()==='OPTIONS'){await route.fulfill({status:204,headers});return;}
        const result=await bridge({url:request.url(),method:request.method(),headers:request.headers(),...(request.postData()?{body:request.postData()!}:{})});await route.fulfill({status:result.status,headers,contentType:'application/json',body:JSON.stringify(result.data)});
      });
      await web.setViewportSize({width:1365,height:900});await web.goto(origin+'/plus.html',{waitUntil:'networkidle'});await web.getByRole('button',{name:'生成接续码',exact:true}).click();
      const code=(await web.getByLabel('电脑接续码').textContent())!.replace(/\s/g,'');
      await b.goto(origin+'/?scenario=account-bindings#/pages/settings/index',{waitUntil:'networkidle'});await b.getByRole('button',{name:'接续到电脑 Plus',exact:true}).click();await b.getByLabel('电脑接续码').fill(code);await b.getByRole('button',{name:'查看接续请求',exact:true}).click();
      await b.getByRole('button',{name:'已绑定的支付宝作品',exact:true}).click();await shot(b,'05-plus-source','Plus 显式选择已绑定作品来源');await b.getByRole('button',{name:'允许这台电脑连接',exact:true}).click();
      await web.bringToFront();await expect(web.getByText('作品来源：已绑定的支付宝端。付费制作和退款请回该来源小程序；解除绑定会关闭当前连接。',{exact:true})).toBeVisible();await shot(web,'06-plus-bound-workspace','电脑 Plus 标明作品来源及原渠道义务');checks.push('EXPLICIT_BOUND_SOURCE_APPROVAL_REACHES_ACTUAL_PLUS_WORKSPACE');
      await b.getByRole('button',{name:'绑定支付宝与抖音账号',exact:true}).click();await b.getByRole('button',{name:'解除这个绑定',exact:true}).click();await expect(b.getByText('支付宝 · 已解除',{exact:true})).toBeVisible();await shot(b,'07-revoked','任一端解除绑定');
      await web.getByRole('button',{name:'刷新',exact:true}).click();await expect(web.getByRole('alert')).toContainText('电脑连接已关闭或到期，请重新接续');await expect(web.getByRole('button',{name:'生成接续码',exact:true})).toBeVisible();checks.push('REVOKED_BINDING_IS_REJECTED_BY_EXISTING_PLUS_SESSION_ON_NEXT_OPERATION');
      const recording=b.video();await b.close();videoPath=await recording?.path();await a.close();await web.close();
    }finally{await aContext.close();await bContext.close();}
  }finally{await browser.close();browserClosed=true;}
}finally{
  if(server.exitCode===null&&server.signalCode===null){try{execFileSync('taskkill.exe',['/PID',String(server.pid),'/T','/F'],{windowsHide:true,stdio:'ignore',timeout:10000});}catch{server.kill();}}
  if(server.exitCode===null&&server.signalCode===null)await Promise.race([new Promise<void>(done=>server.once('close',()=>done())),delay(5000)]);
  serverClosed=server.exitCode!==null||server.signalCode!==null;await f.close();
}
if(errors.length||!videoPath||!browserClosed||!serverClosed)throw new Error(JSON.stringify({browser_errors:errors,browserClosed,serverClosed,recorded:!!videoPath}));
await copyFile(videoPath,resolve(output,'walkthrough.webm'));
const ffmpeg=process.env.FFMPEG_PATH?.trim()||'ffmpeg',ffprobe=process.env.FFPROBE_PATH?.trim()||'ffprobe';
const run=(args:string[])=>execFileSync(ffmpeg,['-hide_banner','-loglevel','error','-y',...args],{windowsHide:true,timeout:45000,maxBuffer:2000000});
run(['-i',videoPath,'-an','-c:v','libx264','-crf','26','-pix_fmt','yuv420p','-movflags','+faststart',resolve(output,'walkthrough.mp4')]);
run(['-i',videoPath,'-vf','fps=5,scale=280:-2:flags=lanczos,split[a][b];[a]palettegen=max_colors=80[p];[b][p]paletteuse=dither=bayer:bayer_scale=3','-loop','0',resolve(output,'walkthrough.gif')]);
const media=[];for(const path of [...shots.map(shot=>shot.path),'docs/media/account-bindings/walkthrough.webm','docs/media/account-bindings/walkthrough.mp4','docs/media/account-bindings/walkthrough.gif']){const bytes=await readFile(path);media.push({path,bytes:bytes.length,sha256:sha(bytes)});}
const probe=JSON.parse(execFileSync(ffprobe,['-v','error','-show_entries','format=duration:stream=codec_name,width,height','-of','json',resolve(output,'walkthrough.mp4')],{windowsHide:true,timeout:10000,encoding:'utf8'}));
await writeFile(resolve(output,'manifest.json'),JSON.stringify({checked_at:new Date().toISOString(),source_set_hash:report.source_set_hash,classification:'ACTUAL_SHARED_UI_NATIVE_HTTP_AND_PG_WITH_SYNTHETIC_IDENTITIES_ORDER_QA_AND_PNG',checks,shots,media,video_probe:probe,browser_errors:errors,browser_closed:browserClosed,owned_tabs_closed:true,owned_preview_server_closed:serverClosed,temporary_schema_removed:true,real_device_verified:false,actual_platform_login_verified:false,actual_album_save_verified:false,production_admitted:false},null,2)+'\n');
console.log(JSON.stringify({recorded:true,screenshots:shots.length,checks:checks.length,browser_closed:browserClosed,owned_preview_server_closed:serverClosed,manifest:'docs/media/account-bindings/manifest.json'}));
