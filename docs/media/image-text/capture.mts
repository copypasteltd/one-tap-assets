import {chromium,expect} from '@playwright/test';
import {build as bundle} from 'esbuild';
import {execFileSync} from 'node:child_process';
import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import '../../../scripts/delivery/local-env.ts';
import {local,sha,snapshot} from '../../../scripts/delivery/common.ts';
import {supportRepairEnvironment} from '../../../tests/helpers/support-repair.ts';
import {createDownloadLink,getDeliverables} from '../../../src/api/modules/delivery.ts';

// A recording harness around the unchanged shared mini-program component.
// Synthetic identity/semantics, actual HTTPS API, media and five-stage worker.
const source=await snapshot(),build=JSON.parse(await readFile('docs/delivery/current.json','utf8'));
if(source.source_set_hash!==build.source_set_hash)throw new Error('Current build required');
process.env.YPCC_BUILD_ROOT=local(build.build_root);
await copyFile(`${build.build_root}/worker/tool-gateway/mcp-main.js`,'runtime/build/worker/tool-gateway/mcp-main.js');
const output='docs/media/image-text';await mkdir(output,{recursive:true});
const env=await supportRepairEnvironment(),checks:string[]=[],errors:string[]=[],external:string[]=[],files=[];
let browserClosed=false,appClosed=false,videoPath:string|undefined,revisionId='';
const tmp=local('runtime/tmp/image-title-browser.tsx');
try{
  const initial=env.parent.items.find(i=>i.kind==='image')!;
  const initialRow=(await env.db.pool.query('SELECT object_key FROM artifacts WHERE id=$1',[initial.deliverable_id])).rows[0];
  await writeFile(local(output+'/original.png'),await env.f.store.get(initialRow.object_key));
  const code=`import React,{useState,useEffect} from 'react';
import {createRoot} from 'react-dom/client';
import {LimitedRevision} from '../../src/shared/ui/revision';
import {configureHost,client} from '../../src/shared/ui/runtime';
const memory=new Map();
configureHost({platform:'alipay',storage:{get:k=>memory.get(k)??null,set:(k,v)=>memory.set(k,v),remove:k=>memory.delete(k)},
 transport:async r=>{const x=await fetch(r.url,{method:r.method,headers:r.headers,body:r.body,signal:r.signal});return {status:x.status,data:await x.json(),headers:{}};},
 login:async()=>{throw new Error('No real host login');}});
client().attach(${JSON.stringify({access_token:env.buyer,token_type:'Bearer',expires_at:new Date(Date.now()+3600000).toISOString(),user_id:env.f.p.userId})});
function App(){const [pack,setPack]=useState(${JSON.stringify(env.parent)}),[image,setImage]=useState('');
 const reload=async()=>setPack(await client().api.call('getDeliverables',{params:{order_id:pack.order_id}}));
 useEffect(()=>{const item=pack.items.find(i=>i.kind==='image');client().api.call('createDownloadLink',{params:{deliverable_id:item.deliverable_id},key:client().intent('record-image',{id:item.deliverable_id})}).then(x=>setImage(x.url));},[pack.manifest_id]);
 return <main className="page"><div className="panel"><h2>一品成片 · 素材领取</h2><p>共享小程序组件回放 · 合成商品与复核</p><p>素材版本 <strong data-testid="version">{pack.manifest_revision}</strong></p>{image&&<img alt="当前交付图片" src={image} style={{width:'100%',height:'auto'}}/>}</div><LimitedRevision key={pack.manifest_id} pack={pack} onDelivered={reload}/></main>;}
createRoot(document.getElementById('root')).render(<App/>);`;
  await writeFile(tmp,code);
  const compiled=await bundle({entryPoints:[tmp],bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',
    alias:{'@tarojs/components':local('src/preview/components.tsx'),'@tarojs/taro':local('src/preview/taro.ts')},
    define:{__YPCC_API_BASE__:JSON.stringify(env.origin),'process.env.NODE_ENV':'"production"'}});
  const cssFile=build.components.find((c:any)=>c.name==='preview').files.find((f:any)=>f.path.endsWith('.css'));
  const css=await readFile(cssFile.path,'utf8');
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try{
    const context=await browser.newContext({viewport:{width:430,height:932},deviceScaleFactor:1,locale:'zh-CN',ignoreHTTPSErrors:true,
      recordVideo:{dir:local('runtime/preview-recordings/image-text'),size:{width:430,height:932}}});context.setDefaultTimeout(15000);
    try{
      const page=await context.newPage();
      page.on('pageerror',e=>errors.push(e.message));
      page.on('requestfailed',r=>console.log('LOCAL_REQUEST_FAILED',new URL(r.url()).pathname,r.failure()?.errorText));
      page.on('request',request=>{if(/^https?:/.test(request.url())&&!request.url().startsWith(env.origin+'/'))external.push(new URL(request.url()).origin);});
      page.on('response',async response=>{if(response.request().method()==='POST'&&response.url().endsWith('/revisions'))revisionId=(await response.json()).data.revision_id;});
      await page.route(env.origin+'/_capture/index.html',async route=>{console.log('LOCAL_HTML_ROUTE');await route.fulfill({contentType:'text/html',body:`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>图片加字 · 共享组件回放</title><style>${css}body{margin:0;background:#f6f5ef}.page{max-width:430px;margin:auto;padding:16px;box-sizing:border-box}.panel{background:white;padding:18px;border-radius:20px;margin-bottom:18px}h2{font-size:22px}</style><div id="root"></div><script src="app.js"></script></html>`});});
      await page.route(env.origin+'/_capture/app.js',async route=>{console.log('LOCAL_JS_ROUTE');await route.fulfill({contentType:'application/javascript',body:Buffer.from(compiled.outputFiles[0]!.contents)});});
      await page.route(env.origin+'/_capture/*.ttf',async route=>{
        const name=new URL(route.request().url()).pathname.split('/').at(-1)!;
        const font=build.components.find((c:any)=>c.name==='preview').files.find((f:any)=>f.path.endsWith('/'+name));
        if(!font)throw new Error('Missing current preview font');
        await route.fulfill({contentType:'font/ttf',body:await readFile(font.path)});
      });
      await page.goto(env.origin+'/_capture/index.html',{waitUntil:'domcontentloaded',timeout:30000});
      console.log('SHARED_COMPONENT_DOCUMENT_LOADED');
      await page.evaluate(()=>document.fonts.ready);
      await expect(page.getByAltText('当前交付图片')).toBeVisible();
      await page.getByText('交付后的小修改',{exact:true}).scrollIntoViewIfNeeded();
      await page.screenshot({path:local(output+'/01-delivered-pack.png')});
      await page.getByRole('button',{name:'图片加字',exact:true}).click();
      await expect(page.getByRole('button',{name:'提交这次小修改',exact:true})).toBeDisabled();checks.push('EMPTY_TITLE_CANNOT_SUBMIT');
      await page.getByRole('textbox').fill('看得见的真实细节');
      await expect(page.getByRole('button',{name:'提交这次小修改',exact:true})).toBeEnabled();
      await page.screenshot({path:local(output+'/02-image-title.png')});
      await page.getByRole('button',{name:'提交这次小修改',exact:true}).click();
      await expect.poll(()=>revisionId).not.toBe('');checks.push('SHARED_MINI_COMPONENT_POSTS_REAL_FROZEN_IMAGE_REQUEST');
      const pack=await env.completeRepair(revisionId),edited=pack.items.find(i=>i.slot_id===initial.slot_id)!;
      expect(edited.sha256).not.toBe(initial.sha256);expect(pack.expires_at).toBe(env.parent.expires_at);
      const artifact=(await env.db.pool.query('SELECT object_key FROM artifacts WHERE id=$1',[edited.deliverable_id])).rows[0];
      const bytes=await env.f.store.get(artifact.object_key);expect(sha(bytes)).toBe(edited.sha256);await writeFile(local(output+'/edited.png'),bytes);
      const link=await createDownloadLink(env.db.pool,env.f.cfg,env.f.p,edited.deliverable_id);
      const download=await env.app.inject({url:link.url});expect(download.statusCode).toBe(200);expect(sha(download.rawPayload)).toBe(edited.sha256);
      checks.push('ACTUAL_FIVE_STAGE_IMAGE_PIXELS_FRESH_DUAL_REVIEW_AND_DOWNLOAD_SHA');
      await expect(page.getByTestId('version')).toHaveText('2',{timeout:20000});
      await expect(page.getByAltText('当前交付图片')).toBeVisible();await page.getByAltText('当前交付图片').scrollIntoViewIfNeeded();
      await page.screenshot({path:local(output+'/03-new-image-delivered.png')});
      expect((await getDeliverables(env.db.pool,env.f.p,env.f.orderId)).items).toEqual(pack.items);
      checks.push('COMPONENT_POLLS_ORIGINAL_REQUEST_AND_LOADS_ACTUAL_NEW_MANIFEST');
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);checks.push('NO_HORIZONTAL_OVERFLOW_AT_430PX');
      const recording=page.video();await page.close();videoPath=await recording?.path();
    }finally{await context.close();}
  }finally{await browser.close();browserClosed=true;}
}finally{await env.close();appClosed=true;}
if(errors.length||external.length||!videoPath)throw new Error(JSON.stringify({errors,external,videoPathPresent:!!videoPath}));
await copyFile(videoPath,local(output+'/walkthrough.webm'));
const run=(args:string[])=>execFileSync(process.env.FFMPEG_PATH?.trim()||'ffmpeg',['-hide_banner','-loglevel','error','-y',...args],{windowsHide:true,timeout:60000,maxBuffer:2000000});
run(['-i',videoPath,'-an','-c:v','libx264','-crf','27','-pix_fmt','yuv420p','-movflags','+faststart',local(output+'/walkthrough.mp4')]);
run(['-i',videoPath,'-vf','fps=3,scale=430:-2:flags=lanczos,split[a][b];[a]palettegen=max_colors=64[p];[b][p]paletteuse=dither=bayer:bayer_scale=3','-loop','0',local(output+'/walkthrough.gif')]);
for(const name of ['original.png','edited.png','01-delivered-pack.png','02-image-title.png','03-new-image-delivered.png','walkthrough.webm','walkthrough.mp4','walkthrough.gif']){
  const path=output+'/'+name,bytes=await readFile(local(path));files.push({path,bytes:bytes.length,sha256:sha(bytes)});
}
if(JSON.stringify(await snapshot())!==JSON.stringify(source))throw new Error('Source changed during capture');
await writeFile(local(output+'/capture-manifest.json'),JSON.stringify({captured_at:new Date().toISOString(),source_set_hash:source.source_set_hash,build_root:build.build_root,
  type:'ACTUAL_SHARED_MINI_COMPONENT_HTTPS_FIVE_STAGE_IMAGE_TITLE',synthetic_product_semantics_identity_and_metering:true,
  native_mini_device_verified:false,production_admitted:false,full_product_verified:false,browser_tabs_closed:browserClosed,owned_api_and_database_pool_closed:appClosed,
  capture_script:{path:output+'/capture.mts',sha256:sha(await readFile(local(output+'/capture.mts')))},checks,browser_errors:errors,external_network_requests:external,files},null,2)+'\n');
console.log(JSON.stringify({status:'PASS',checks:checks.length,media_files:files.length,browser_closed:browserClosed,owned_services_closed:appClosed}));
