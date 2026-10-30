import {spawn,execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {local,json} from './common.js';

const args=process.argv.slice(2);
if(args.some(arg=>!['--server-only','--skip-mini'].includes(arg))||new Set(args).size!==args.length
  ||args.includes('--server-only')&&args.includes('--skip-mini'))
  throw new Error('Use delivery:final [--server-only | --skip-mini]; full tests are not part of this command');
const before=await readFile(local('docs/delivery/current.json'),'utf8').catch(error=>{
  if((error as NodeJS.ErrnoException).code==='ENOENT')return '';throw error;
});
async function run(script:string,extra:string[]=[]):Promise<number>{
  const child=spawn(process.execPath,['--import','tsx',script,...extra],{cwd:process.cwd(),env:process.env,stdio:'inherit',shell:false,windowsHide:true});
  let interrupted=false;
  const stop=()=>{interrupted=true;if(child.pid&&child.exitCode===null){
    if(process.platform==='win32')try{execFileSync('taskkill.exe',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});return;}catch{}
    child.kill('SIGTERM');
  }};
  process.once('SIGINT',stop);process.once('SIGTERM',stop);
  try{const code=await new Promise<number>((done,fail)=>{child.once('error',fail);child.once('close',code=>done(code??1));});
    if(interrupted)throw new Error('Delivery cancelled; no later step will reuse an old report');return code;}
  finally{process.removeListener('SIGINT',stop);process.removeListener('SIGTERM',stop);}
}
const buildCode=await run('scripts/delivery/build.ts',args);
const after=await readFile(local('docs/delivery/current.json'),'utf8');
if(before===after)throw new Error('Build stopped without a new delivery report; an older package will not be reused');
const build=JSON.parse(after) as {id:string;selected_builds_passed:boolean;components:{name:string;status:string}[]};
const packageCode=await run('scripts/delivery/package.ts');
if(packageCode!==0)throw new Error('Packaging failed; inspect the recorded component statuses');
const archive=JSON.parse(await readFile(local('docs/delivery/package.json'),'utf8')) as {id:string;archive_path:string;archive_sha256:string};
if(archive.id!==build.id)throw new Error('Archive does not match this build');
const result={checked_at:new Date().toISOString(),build_id:build.id,build_exit_code:buildCode,
  selected_builds_passed:build.selected_builds_passed,components:build.components.map(({name,status})=>({name,status})),
  archive_path:archive.archive_path,archive_sha256:archive.archive_sha256,full_suite_executed:false,
  full_product_verified:false,production_admitted:false,cloud_deployed:false};
await json('runtime/delivery/final.json',result);
console.log(JSON.stringify(result,null,2));
if(buildCode!==0)process.exitCode=1;
