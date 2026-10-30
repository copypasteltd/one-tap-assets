import {afterEach, describe, expect, it} from 'vitest';
import {createRequire} from 'node:module';
import {mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {resolve, join} from 'node:path';
const {finalizeMiniArtifacts, validateMiniArtifacts}=createRequire(import.meta.url)('../../scripts/mini-artifacts.cjs');
const roots:string[]=[];
const pages=['pages/home/index','pages/order/index'];
function candidate(platform:'alipay'|'tt'){
  mkdirSync('runtime/tmp',{recursive:true});const root=mkdtempSync(resolve('runtime/tmp/mini-artifact-test-'));roots.push(root);
  const template=platform==='alipay'?'.axml':'.ttml',style=platform==='alipay'?'.acss':'.ttss';
  const files:Record<string,string>={'app.json':JSON.stringify({pages}),'app.js':'require("./taro");',
    'taro.js':'module.exports = {};',[`app${style}`]:'page{color:#263b32}',[`base${template}`]:'<template name="root"><view/></template>'};
  for(const page of pages){files[page+'.js']='require("../../taro.js");';files[page+'.json']='{}';files[page+template]=`<import src="../../base${template}"/>`;}
  for(const [path,bytes] of Object.entries(files)){mkdirSync(resolve(root,path,'..'),{recursive:true});writeFileSync(join(root,path),bytes);}
  return root;
}
afterEach(()=>{for(const path of roots.splice(0)){if(!path.startsWith(resolve('runtime/tmp')+requireSeparator()))throw new Error('Unexpected test directory');rmSync(path,{recursive:true,force:true});}});
function requireSeparator(){return process.platform==='win32'?'\\':'/';}
describe('mini delivery artifacts',()=>{
  it.each(['alipay','tt'] as const)('seals a complete %s IDE directory without inventing app IDs',platform=>{
    const root=candidate(platform);finalizeMiniArtifacts(root,platform);
    const report=validateMiniArtifacts(root,platform,pages);
    expect(report.page_count).toBe(2);expect(report.local_dependencies_checked).toBe(5);
    expect(report.host_launch_verified).toBe(false);
    const project=JSON.parse(readFileSync(join(root,report.project_configuration),'utf8'));
    expect(project.appid).toBeUndefined();expect(project.miniprogramRoot).toBe('./');
  });
  it('rejects a partial page and a different compiled route list',()=>{
    const root=candidate('alipay');finalizeMiniArtifacts(root,'alipay');
    expect(()=>validateMiniArtifacts(root,'alipay',[pages[0]])).toThrow(/differ from source/);
    rmSync(join(root,pages[1]+'.axml'));
    expect(()=>validateMiniArtifacts(root,'alipay',pages)).toThrow(/Missing or empty/);
  });
  it('rejects corrupted JavaScript and altered sealed bytes',()=>{
    const root=candidate('tt');finalizeMiniArtifacts(root,'tt');
    writeFileSync(join(root,'taro.js'),'module.exports = {');
    expect(()=>validateMiniArtifacts(root,'tt',pages)).toThrow();
    writeFileSync(join(root,'taro.js'),'module.exports = {changed:true};');
    expect(()=>validateMiniArtifacts(root,'tt',pages)).toThrow(/manifest differs/);
  });
  it('rejects dependencies outside the compiled directory',()=>{
    const root=candidate('tt');finalizeMiniArtifacts(root,'tt');
    writeFileSync(join(root,pages[0]+'.ttml'),'<import src="../../../outside.ttml"/>');
    expect(()=>validateMiniArtifacts(root,'tt',pages)).toThrow(/escapes output/);
  });
});
