import {lstat,readFile} from 'node:fs/promises';
import {isAbsolute,join,relative,resolve,sep} from 'node:path';
import {sha,type FileEntry} from './common.js';

type Purpose='server'|'preview'|'alipay'|'douyin';
export interface LocalBuild {
  root:string;
  selection:'CURRENT_DELIVERY'|'MAPPED_DELIVERY'|'EXPLICIT_LOCAL'|'LOCAL_DEFAULT';
  build_id:string|null;
  hashes_verified:boolean;
}
interface Report {
  id:string;build_root:string;source_set_hash:string;
  files:FileEntry[];runtime_contract_files:FileEntry[];resource_files:FileEntry[];
  components:{name:string;status:string;files:FileEntry[]}[];
}
const required={
  server:['api/main.js','worker/main.js','worker/tool-gateway/mcp-main.js','worker/lifecycle/reaper-main.js','worker/lifecycle/media-maintenance-main.js','worker/lifecycle/privacy-journal-main.js'],
  preview:['preview/index.html','preview/plus.html','preview/support.html','preview/review.html','preview/metrics.html'],
  alipay:['mini-alipay/app.json','mini-alipay/app.js'],
  douyin:['mini-douyin/app.json','mini-douyin/app.js'],
} as const;

async function owned(project:string,path:string):Promise<string>{
  const target=resolve(project,path),rel=relative(project,target);
  if(!rel||rel.startsWith('..')||isAbsolute(rel))throw new Error('Build paths must stay inside the project');
  let cursor=project;
  for(const part of rel.split(sep)){
    cursor=join(cursor,part);
    if((await lstat(cursor)).isSymbolicLink())throw new Error('Build paths cannot traverse links');
  }
  return target;
}
async function available(project:string,path:string):Promise<boolean>{
  try{await owned(project,path);return true;}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return false;throw error;}
}
async function requireEntries(project:string,build:string,purpose:Purpose):Promise<void>{
  for(const path of required[purpose])if(!(await lstat(await owned(project,join(build,path)))).isFile())throw new Error('Missing build entry');
}
async function verify(project:string,path:string,expected:string):Promise<void>{
  if(!/^[a-f0-9]{64}$/.test(expected)||sha(await readFile(await owned(project,path)))!==expected)
    throw new Error(`Build/source checksum mismatch: ${path}; run delivery:build again`);
}

/** Resolve only project-owned native outputs. Explicit developer roots remain visibly unverified. */
export async function resolveLocalBuild(purpose:Purpose,options:{projectRoot?:string;explicitRoot?:string|undefined}={}):Promise<LocalBuild>{
  const project=resolve(options.projectRoot??process.cwd());
  if((await lstat(project)).isSymbolicLink())throw new Error('Project root cannot be a link');
  const explicit=options.explicitRoot?.trim();
  if(explicit){
    const build=await owned(project,explicit),rel=relative(project,build);
    if(!rel.startsWith(`runtime${sep}`))throw new Error('Explicit build root must be inside project runtime');
    await requireEntries(project,build,purpose);
    return {root:build,selection:'EXPLICIT_LOCAL',build_id:null,hashes_verified:false};
  }
  const reportPath='docs/delivery/current.json';
  if(!await available(project,reportPath)){
    const build=resolve(project,'runtime/build');await requireEntries(project,build,purpose);
    return {root:build,selection:'LOCAL_DEFAULT',build_id:null,hashes_verified:false};
  }
  const path=await owned(project,reportPath),size=(await lstat(path)).size;
  if(size>8*1024*1024)throw new Error('Delivery report is too large');
  const report=JSON.parse(await readFile(path,'utf8')) as Report;
  if(!report||typeof report.id!=='string'||!/^runtime\/delivery-builds\/[A-Za-z0-9T.-]+\/runtime\/build$/.test(report.build_root)
    ||!Array.isArray(report.files)||report.files.length===0||!Array.isArray(report.runtime_contract_files)||!Array.isArray(report.resource_files)
    ||!Array.isArray(report.components)||sha(JSON.stringify(report.files))!==report.source_set_hash)
    throw new Error('Invalid current delivery report; run delivery:build');
  const wanted=report.components.filter(c=>c.name===purpose||(purpose==='server'&&c.name==='preview'&&c.status==='PASS'));
  if(wanted.filter(c=>c.name===purpose&&c.status==='PASS').length!==1||wanted.some(c=>!Array.isArray(c.files)||c.files.length===0))
    throw new Error(`Current delivery has no successful ${purpose} build; run delivery:build`);
  for(const file of [...report.files,...report.runtime_contract_files,...report.resource_files])await verify(project,file.path,file.sha256);
  const direct=await available(project,report.build_root),build=resolve(project,direct?report.build_root:'runtime/build');
  for(const component of wanted){
    for(const file of component.files){
      const prefix=report.build_root+'/';
      if(!file.path.startsWith(prefix))throw new Error('Build output escaped the current delivery root');
      const suffix=file.path.slice(prefix.length);
      if(!/^(api|worker|preview|mini-alipay|mini-douyin)\//.test(suffix))throw new Error('Unexpected local build component');
      await verify(project,join(build,suffix),file.sha256);
    }
    const need=required[component.name as Purpose];
    for(const entry of need)if(!component.files.some(f=>f.path===`${report.build_root}/${entry}`))throw new Error('Incomplete current build manifest');
  }
  await requireEntries(project,build,purpose);
  return {root:build,selection:direct?'CURRENT_DELIVERY':'MAPPED_DELIVERY',build_id:report.id,hashes_verified:true};
}
