import {chromium,expect,type Page} from '@playwright/test';
import {mkdir,readFile,writeFile,copyFile,readdir} from 'node:fs/promises';
import {resolve,relative} from 'node:path';
import {execFileSync} from 'node:child_process';
import {loadEnvFile} from 'node:process';
import {existsSync} from 'node:fs';
import sharp from 'sharp';
import {sha256} from '../src/api/lib/crypto.js';
if(existsSync('.env.local'))loadEnvFile('.env.local');
const media=resolve('docs/media'),demo=resolve(media,'demo');await mkdir(demo,{recursive:true});await mkdir(resolve(demo,'assets'),{recursive:true});
const svg=await readFile(resolve(demo,'product.svg'));
await sharp(svg).png().toFile(resolve(demo,'product-card.png'));
for(let i=0;i<3;i++)await sharp(svg).resize(360,480).png().toFile(resolve(demo,`assets/example-${i}.png`));
const ffmpeg=process.env.FFMPEG_PATH?.trim()||'ffmpeg',ffprobe=process.env.FFPROBE_PATH?.trim()||'ffprobe';
const run=(args:string[])=>execFileSync(ffmpeg,['-hide_banner','-loglevel','error','-y',...args],{windowsHide:true,timeout:60000,maxBuffer:2000000});
run(['-loop','1','-i',resolve(demo,'product-card.png'),'-vf','scale=540:720,pad=540:960:0:120:color=0xFFFAEE','-t','4','-r','24','-an','-c:v','libx264','-pix_fmt','yuv420p','-movflags','+faststart',resolve(demo,'product-motion.mp4')]);
const browser=await chromium.launch({channel:'msedge',headless:true});
const screenshots:{page:string;path:string}[]=[],errors:string[]=[],requests:string[]=[];
let videoPath:string|undefined;
try{
  const context=await browser.newContext({viewport:{width:430,height:932},deviceScaleFactor:1,locale:'zh-CN',colorScheme:'light',
    recordVideo:{dir:resolve('runtime/preview-recordings'),size:{width:430,height:932}}});
  const page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));
  page.on('requestfailed',r=>errors.push(`${r.method()} ${new URL(r.url()).pathname} ${r.failure()?.errorText}`));
  page.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith('http://127.0.0.1:4173/'))requests.push(r.url());});
  await page.goto('http://127.0.0.1:4173/',{waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready);
  await expect(page.getByText('拍下商品，')).toBeVisible();
  const shot=async(name:string)=>{await page.waitForTimeout(700);const path=`docs/media/screenshots/${name}.png`;await mkdir(resolve(media,'screenshots'),{recursive:true});await page.screenshot({path,fullPage:false});screenshots.push({page:name,path});};
  await shot('01-home');
  await page.getByRole('button',{name:'拍照做素材'}).click();
  await page.getByRole('button',{name:'拍照或从相册选择'}).click();await expect(page.locator('.selected-photo')).toHaveCount(3);await shot('02-photos');
  const scene=async(value:string)=>{await page.getByLabel('演示场景').selectOption(value);await page.waitForTimeout(700);};
  await scene('analysis');await expect(page.getByText('已经认识你的商品')).toBeVisible();await shot('03-analysis');
  await page.getByRole('button',{name:'挑选一套方案'}).click();await expect(page.locator('.preset-card')).toHaveCount(10);await shot('04-community');
  await page.locator('.preset-card').first().click();await expect(page.getByText('这套方案还在准备中')).toBeVisible();await shot('05-preset');
  await scene('confirm');await expect(page.getByText('确认这一套素材')).toBeVisible();await shot('06-checklist');
  await scene('order');await expect(page.locator('.stage-complete')).toHaveCount(6);await shot('07-order');
  await page.getByRole('button',{name:'查看完整素材包'}).click();await page.getByRole('button',{name:'查看素材',exact:true}).first().click();
  await expect(page.locator('.pack-image')).toBeVisible();await shot('08-pack');
  await scene('library');await expect(page.getByRole('button',{name:'查看素材包',exact:true})).toBeVisible();await shot('09-library');
  await scene('creator');await shot('10-creator');
  await page.waitForTimeout(1000);const recording=page.video();await page.close();await context.close();videoPath=await recording?.path();
}finally{await browser.close();}
if(errors.length||requests.length)throw new Error(JSON.stringify({browserErrors:errors,externalRequests:requests}));
if(!videoPath)throw new Error('Missing actual browser recording');
await copyFile(videoPath,resolve(media,'walkthrough.webm'));
run(['-i',videoPath,'-an','-c:v','libx264','-crf','25','-pix_fmt','yuv420p','-movflags','+faststart',resolve(media,'walkthrough.mp4')]);
run(['-i',videoPath,'-vf','fps=7,scale=344:-2:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=96[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3','-loop','0',resolve(media,'walkthrough.gif')]);
const cards=await Promise.all(['01-home','04-community','06-checklist','08-pack'].map(async(name,index)=>({input:await sharp(resolve(media,`screenshots/${name}.png`)).resize(344,746).png().toBuffer(),left:index*368+12,top:12})));
await sharp({create:{width:1472,height:770,channels:3,background:'#e9eee8'}}).composite(cards).png().toFile(resolve(media,'overview.png'));
const files=[];for(const folder of ['screenshots','demo','demo/assets',''])for(const name of await readdir(resolve(media,folder))){
  if(!/\.(png|gif|mp4|webm|svg)$/.test(name))continue;const path=resolve(media,folder,name),bytes=await readFile(path);
  files.push({path:relative(process.cwd(),path).replaceAll('\\','/'),bytes:bytes.length,sha256:sha256(bytes)});
}
const inspection=JSON.parse(execFileSync(ffprobe,['-v','error','-show_entries','format=duration:stream=codec_name,width,height','-of','json',resolve(media,'walkthrough.mp4')],{windowsHide:true,encoding:'utf8',timeout:30000}));
await writeFile(resolve(media,'capture-manifest.json'),JSON.stringify({captured_at:new Date().toISOString(),type:'ACTUAL_BROWSER_RECORDING_SHARED_MINI_PAGES',
  data_source:'SYNTHETIC_LOCAL_FIXTURES',native_mini_device_verified:false,real_generation_verified:false,real_payment_verified:false,
  browser_tabs_closed:true,browser_errors:errors,external_network_requests:requests,screenshots,recording:inspection,files},null,2)+'\n');
process.stdout.write(JSON.stringify({status:'PASS',screenshots:screenshots.length,files:files.length,recording:inspection.format,browser_closed:true})+'\n');
