import {createHash} from 'node:crypto';
import {createWriteStream} from 'node:fs';
import {lstat,readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import {resolve,relative,join,sep,isAbsolute} from 'node:path';
import {spawn,execFileSync} from 'node:child_process';
export const root=process.cwd();
export const sha=(data:Buffer|string):string=>createHash('sha256').update(data).digest('hex');
export interface FileEntry {path:string;sha256:string;bytes:number}
export function local(path:string):string {
  const value=resolve(root,path),rel=relative(root,value);
  if(rel.startsWith('..')||isAbsolute(rel))throw new Error('Path must stay inside this project');return value;
}
export async function checked(path:string):Promise<string>{
  const target=local(path);let current=root;
  for(const part of relative(root,target).split(sep).filter(Boolean)){
    current=join(current,part);const info=await lstat(current);
    if(info.isSymbolicLink())throw new Error('Delivery paths cannot traverse links');
  }return target;
}
export async function inventory(directory:string,accept:(name:string)=>boolean=()=>true):Promise<FileEntry[]>{
  const out:FileEntry[]=[];
  async function walk(dir:string):Promise<void>{
    for(const item of (await readdir(await checked(dir),{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){
      const path=join(dir,item.name);if(item.isSymbolicLink())throw new Error('Linked delivery input');
      if(item.isDirectory())await walk(path);else if(item.isFile()&&accept(item.name)){
        const data=await readFile(path);out.push({path:relative(root,path).replaceAll('\\','/'),sha256:sha(data),bytes:data.length});
      }
    }
  }await walk(local(directory));return out;
}
export async function snapshot(){
  const files:Pick<FileEntry,'path'|'sha256'>[]=[];
  for(const dir of ['src','tests','scripts'])files.push(...(await inventory(dir,n=>/\.(?:ts|tsx|cjs|js|css|html|sql|json|py|ps1)$/.test(n))).map(({path,sha256})=>({path,sha256})));
  for(const path of ['package.json','pnpm-lock.yaml','.npmrc','tsconfig.json','vitest.config.ts','vitest.integration.config.ts'])files.push({path,sha256:sha(await readFile(path))});
  const contracts:Pick<FileEntry,'path'|'sha256'>[]=[];
  for(const dir of ['assets/development/v1.1/contracts','assets/skills/ypcc/v1.0'])contracts.push(...(await inventory(dir,n=>/\.(json|md)$/.test(n))).map(({path,sha256})=>({path,sha256})));
  for(const path of ['assets/presets/presets.v3.1.json','assets/blueprints/云端方案映射.v3.1.json','assets/design/柚子创作社/v1.0/design-tokens.json'])contracts.push({path,sha256:sha(await readFile(path))});
  const resources=await Promise.all(['NotoSansSC[wght].ttf','OFL.txt','METADATA.pb','source.json'].map(async n=>{const path=`assets/resources/fonts/noto-sans-sc/${n}`;return {path,sha256:sha(await readFile(path))};}));
  return {source_set_hash:sha(JSON.stringify(files)),files,runtime_contract_files:contracts,resource_files:resources};
}
export async function directory(path:string):Promise<string>{
  const target=local(path);let current=root;
  for(const part of relative(root,target).split(sep).filter(Boolean)){
    current=join(current,part);try{await mkdir(current);}catch(error){if((error as NodeJS.ErrnoException).code!=='EEXIST')throw error;}
    const info=await lstat(current);if(!info.isDirectory()||info.isSymbolicLink())throw new Error('Output directory cannot traverse a link');
  }return target;
}
export async function json(path:string,value:unknown):Promise<void>{
  await directory(resolve(local(path),'..'));try{await checked(path);}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
  await writeFile(local(path),JSON.stringify(value,null,2)+'\n');
}
export async function command(task:string,args:string[],logPath:string,timeoutMs:number,env:NodeJS.ProcessEnv=process.env){
  await directory(resolve(local(logPath),'..'));const log=createWriteStream(local(logPath),{flags:'wx'}),started=Date.now();
  const invocation=task==='typecheck'?[local('node_modules/typescript/bin/tsc'),'--noEmit']
    :task==='build:server'?['--import','tsx','scripts/build-server.ts']
    :task==='build:alipay'||task==='build:douyin'?['scripts/build-mini.cjs',task==='build:alipay'?'alipay':'tt']
    :task==='exec'&&args[0]==='vite'?[local('node_modules/vite/bin/vite.js'),...args.slice(1)]
    :task==='exec'&&args[0]==='vitest'?[local('node_modules/vitest/vitest.mjs'),...args.slice(1)]:null;
  if(!invocation)throw new Error('Unsupported focused delivery command');
  const child=spawn(process.execPath,invocation,
    {cwd:root,env,stdio:['ignore','pipe','pipe'],windowsHide:true,shell:false});
  child.stdout.pipe(log,{end:false});child.stderr.pipe(log,{end:false});let timedOut=false;
  const timer=setTimeout(()=>{timedOut=true;if(child.pid){try{execFileSync('taskkill.exe',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});}catch{child.kill();}}},timeoutMs);
  const result=await new Promise<{exit_code:number|null;signal:NodeJS.Signals|null}>((res,rej)=>{child.once('error',rej);child.once('close',(exit_code,signal)=>res({exit_code,signal}));}).finally(()=>clearTimeout(timer));
  await new Promise<void>(res=>log.end(res));const bytes=await readFile(local(logPath));
  const status=timedOut?'TIMEOUT':result.exit_code===0?'PASS':'FAIL';console.log(`${task}: ${status}`);
  return {task,command:`node ${invocation.join(' ')}`,argv:invocation,shell:false,status,...result,timeout_ms:timeoutMs,elapsed_ms:Date.now()-started,log_path:logPath,log_sha256:sha(bytes)};
}
