import {spawn,type ChildProcess} from 'node:child_process';
import './local-env.js';
import {readFile} from 'node:fs/promises';
import {get} from 'node:https';
import {get as getHttp} from 'node:http';
import {setTimeout as delay} from 'node:timers/promises';
import {config} from '../../src/api/config.js';
import {createPool} from '../../src/api/db/pool.js';
import {migrate} from '../../src/api/db/migrate.js';
import {checked} from './common.js';
import {waitForLocalReady} from './readiness.js';
import {resolveLocalBuild} from './resolve-build.js';
const previewOnly=process.argv.includes('--preview-only'),once=process.argv.includes('--once');
const selected=await resolveLocalBuild(previewOnly?'preview':'server',{explicitRoot:process.env.YPCC_BUILD_ROOT});
const build=selected.root;
console.log(JSON.stringify({event:'local_build_selected',...selected}));
const cfg=previewOnly?null:config();
if(cfg&&(cfg.env!=='development'||!['localhost','127.0.0.1','::1'].includes(cfg.host)))throw new Error('local:start requires a loopback development configuration');
const files=previewOnly?['scripts/delivery/serve-preview.ts']:['api/main.js','worker/main.js','worker/lifecycle/reaper-main.js','worker/lifecycle/media-maintenance-main.js'];
for(const path of files)await checked(previewOnly?path:`${build}/${path}`);
const children:ChildProcess[]=[];let stopping=false,failed=false;const servicesReady=new Set<string>();
const readyEvent:Record<string,string>={'worker/main.js':'worker_ready','worker/lifecycle/reaper-main.js':'reaper_ready','worker/lifecycle/media-maintenance-main.js':'media_maintenance_ready'};
async function stop(){if(stopping)return;stopping=true;for(const child of children)if(child.exitCode===null&&child.signalCode===null)child.kill('SIGTERM');
  await Promise.all(children.map(child=>child.exitCode!==null||child.signalCode!==null?Promise.resolve():new Promise<void>(done=>{
    const timer=setTimeout(()=>{child.kill('SIGKILL');done();},5000);child.once('exit',()=>{clearTimeout(timer);done();});
  })));
}
for(const signal of ['SIGINT','SIGTERM'] as const)process.once(signal,()=>{void stop();});
function launch(name:string,args:string[],extra:NodeJS.ProcessEnv={}){
  const child=spawn(process.execPath,args,{cwd:process.cwd(),shell:false,windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,...extra}});
  child.stdout!.pipe(process.stdout,{end:false});child.stderr!.pipe(process.stderr,{end:false});let tail='';
  child.stdout!.on('data',(part:Buffer)=>{tail=(tail+part.toString()).slice(-64000);if(readyEvent[name]&&tail.includes(`"event":"${readyEvent[name]}"`))servicesReady.add(name);});
  children.push(child);child.once('error',()=>{failed=true;console.error(`${name}: failed to start`);void stop();});
  child.once('exit',()=>{if(!stopping){failed=true;console.error(`${name}: exited; stopping this local group`);void stop();}});return child;
}
try{
  if(previewOnly){
    launch('preview',['--import','tsx','scripts/delivery/serve-preview.ts'],{YPCC_PREVIEW_DIRECTORY:`${build}/preview`});
    const ready=await waitForLocalReady({timeoutMs:30000,stopped:()=>stopping,probe:async remaining=>new Promise<boolean>(done=>{
      const request=getHttp(`http://127.0.0.1:${process.env.YPCC_PREVIEW_PORT||4173}/`,{signal:AbortSignal.timeout(remaining)},response=>{response.resume();done(response.statusCode===200);});request.once('error',()=>done(false));
    })});if(!ready)throw new Error('Built preview did not become ready');
  }
  else{
    const pool=createPool(cfg!);try{await migrate(pool);}finally{await pool.end();}
    for(const file of files)launch(file,[`${build}/${file}`],{YPCC_BUILD_ROOT:build});
    const ca=cfg!.tlsCert?await readFile(cfg!.tlsCert):undefined;
    const origin=new URL(cfg!.publicBaseUrl);if(!['localhost','127.0.0.1','[::1]'].includes(origin.hostname)||origin.username||origin.password||origin.search||origin.hash||origin.pathname!=='/')throw new Error('Local health checks require a loopback origin without credentials');
    const ready=await waitForLocalReady({timeoutMs:45000,stopped:()=>stopping,probe:async remaining=>{
      const apiReady=await new Promise<boolean>(done=>{const request=get(new URL('/readyz',origin),{...(ca?{ca}:{}),signal:AbortSignal.timeout(remaining)},response=>{response.resume();done(response.statusCode===200);});request.once('error',()=>done(false));});
      return apiReady&&Object.keys(readyEvent).every(name=>servicesReady.has(name));
    }});
    if(!ready)throw new Error('Local API, Worker, reaper or media maintenance did not become ready; inspect startup output and run doctor');
    console.log(JSON.stringify({event:'local_stack_ready',api:cfg!.publicBaseUrl,plus:new URL('/plus/',cfg!.publicBaseUrl).href,build_id:selected.build_id,build_root:build,hashes_verified:selected.hashes_verified,ready_services:files,payments_enabled:cfg!.paymentsEnabled,generation_enabled:cfg!.generationEnabled,codex_enabled:cfg!.codex.enabled}));
  }
  if(once)await stop();else while(!stopping)await delay(500);
}finally{await stop();}
if(failed)process.exitCode=1;
