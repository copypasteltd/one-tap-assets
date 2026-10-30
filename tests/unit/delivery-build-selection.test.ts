import {afterEach,it,expect} from 'vitest';
import {mkdtemp,mkdir,writeFile,readFile,rm,symlink} from 'node:fs/promises';
import {join,resolve,relative,isAbsolute} from 'node:path';
import {resolveLocalBuild} from '../../scripts/delivery/resolve-build';
import {sha} from '../../scripts/delivery/common';

const roots:string[]=[];
afterEach(async()=>{for(const root of roots.splice(0)){
  const rel=relative(resolve('runtime/tmp'),resolve(root));if(!rel||rel.startsWith('..')||isAbsolute(rel))throw new Error('Unexpected fixture cleanup target');
  await rm(root,{recursive:true,force:true});
}});
const entries={server:['api/main.js','worker/main.js','worker/tool-gateway/mcp-main.js','worker/lifecycle/reaper-main.js','worker/lifecycle/media-maintenance-main.js','worker/lifecycle/privacy-journal-main.js'],
  preview:['preview/index.html','preview/plus.html','preview/support.html','preview/review.html','preview/metrics.html']};
async function fixture(mapped=false){
  const temp=resolve('runtime/tmp');await mkdir(temp,{recursive:true});const root=await mkdtemp(join(temp,'delivery-selection-'));roots.push(root);
  async function file(path:string,body:string){await mkdir(join(root,path,'..'),{recursive:true});await writeFile(join(root,path),body);return {path,sha256:sha(body),bytes:Buffer.byteLength(body)};}
  const source=await file('src/main.ts','current-source'),files=[{path:source.path,sha256:source.sha256}],build='runtime/delivery-builds/2026-10-31T00-00-00-000Z-fixture/runtime/build';
  const components=[];
  for(const [name,paths] of Object.entries(entries)){
    const output=[];
    for(const path of paths){const entry=await file(`${mapped?'runtime/build':build}/${path}`,`current-${path}`);output.push({...entry,path:`${build}/${path}`});}
    components.push({name,status:'PASS',files:output});
  }
  const report={id:'fixture',build_root:build,source_set_hash:sha(JSON.stringify(files)),files,runtime_contract_files:[],resource_files:[],components};
  await file('docs/delivery/current.json',JSON.stringify(report));
  return {root,build,report,file};
}
it('selects the recorded current output even when stale default binaries are present',async()=>{
  const f=await fixture();await f.file('runtime/build/api/main.js','stale-default');
  const selected=await resolveLocalBuild('server',{projectRoot:f.root});
  expect(selected).toMatchObject({root:resolve(f.root,f.build),selection:'CURRENT_DELIVERY',hashes_verified:true,build_id:'fixture'});
  expect(await readFile(join(selected.root,'preview/plus.html'),'utf8')).toBe('current-preview/plus.html');
});
it('validates the remapped server and Plus outputs after extraction',async()=>{
  const f=await fixture(true);const selected=await resolveLocalBuild('server',{projectRoot:f.root});
  expect(selected).toMatchObject({root:resolve(f.root,'runtime/build'),selection:'MAPPED_DELIVERY',hashes_verified:true});
  expect((await resolveLocalBuild('preview',{projectRoot:f.root})).root).toBe(selected.root);
});
it('rejects a changed Plus asset and refuses to fall back to stale default binaries',async()=>{
  const f=await fixture();await f.file(`${f.build}/preview/plus.html`,'changed');await f.file('runtime/build/api/main.js','stale');
  await expect(resolveLocalBuild('server',{projectRoot:f.root})).rejects.toThrow('checksum mismatch');
});
it('rejects changed source and a partial selected component',async()=>{
  const f=await fixture();await f.file('src/main.ts','new-unbuilt-source');
  await expect(resolveLocalBuild('preview',{projectRoot:f.root})).rejects.toThrow('checksum mismatch');
  await f.file('src/main.ts','current-source');f.report.components[0]!.status='FAIL';
  await f.file('docs/delivery/current.json',JSON.stringify(f.report));
  await expect(resolveLocalBuild('server',{projectRoot:f.root})).rejects.toThrow('no successful server');
});
it('marks an explicit developer output as unverified and rejects paths outside runtime',async()=>{
  const f=await fixture();const selected=await resolveLocalBuild('server',{projectRoot:f.root,explicitRoot:f.build});
  expect(selected).toMatchObject({selection:'EXPLICIT_LOCAL',hashes_verified:false,build_id:null});
  await expect(resolveLocalBuild('server',{projectRoot:f.root,explicitRoot:'src'})).rejects.toThrow('inside project runtime');
  await expect(resolveLocalBuild('server',{projectRoot:f.root,explicitRoot:'../'})).rejects.toThrow('stay inside');
});
it('rejects a directory junction instead of following it',async()=>{
  const f=await fixture(true);await mkdir(join(f.root,'runtime/alias-parent'),{recursive:true});
  await symlink(join(f.root,'runtime/build'),join(f.root,'runtime/alias-parent/linked'),'junction');
  await expect(resolveLocalBuild('server',{projectRoot:f.root,explicitRoot:'runtime/alias-parent/linked'})).rejects.toThrow('cannot traverse links');
});
