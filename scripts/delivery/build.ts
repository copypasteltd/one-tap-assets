import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {resolve} from 'node:path';
import {command,directory,inventory,json,local,sha,snapshot} from './common.js';
import {apiBase} from '../../src/shared/client/api.js';
const id=new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID().slice(0,8);
const base=`runtime/delivery-builds/${id}`,out=`${base}/runtime/build`;await directory(out);
const before=await snapshot(),env={...process.env,YPCC_BUILD_ROOT:local(out),TARO_APP_API_BASE:apiBase(process.env.TARO_APP_API_BASE||'https://localhost:3100')};
const checks=[];
const serverOnly=process.argv.includes('--server-only');
const skipMini=process.argv.includes('--skip-mini');
checks.push(await command('typecheck',[],`${base}/typecheck.log`,180000,env));
checks.push(await command('build:server',[],`${base}/server.log`,180000,env));
if(!serverOnly){
  checks.push(await command('exec',['vite','build','--config','src/preview/vite.config.ts','--outDir',local(`${out}/preview`)],`${base}/preview.log`,180000,env));
  if(!skipMini)for(const host of ['alipay','douyin'])checks.push(await command(`build:${host}`,[],`${base}/${host}.log`,180000,env));
}
if(process.argv.includes('--smoke')){
  // The existing role fixture uses runtime/build. Its compiled bridge must be
  // the same bytes as the fresh candidate before any fixture result is used.
  try{
    const fresh=await readFile(`${out}/worker/tool-gateway/mcp-main.js`),fixture=await readFile('runtime/build/worker/tool-gateway/mcp-main.js');
    if(sha(fresh)!==sha(fixture))throw new Error('Fixture MCP bridge differs from candidate; build:server before running smoke');
    checks.push(await command('exec',['vitest','run','--config','vitest.integration.config.ts','tests/integration/client-photos.test.ts',
      'tests/integration/multipart-upload.test.ts','tests/integration/review-delivery.test.ts',`--outputFile.json=${base}/smoke.json`],`${base}/smoke.log`,180000,env));
  }catch{checks.push({command:'focused-photo-and-delivery-smoke',status:'NOT_RUN',reason:'Candidate and fixture MCP bridge could not be matched'});}
}
const after=await snapshot();if(JSON.stringify(before)!==JSON.stringify(after))throw new Error('Source or contract changed during focused delivery checks');
const components:{name:string;status:string;files:Awaited<ReturnType<typeof inventory>>}[]=[];
const groups=[['server','build:server',['api','worker']],['preview','exec',['preview']],['alipay','build:alipay',['mini-alipay']],['douyin','build:douyin',['mini-douyin']]] as const;
for(const [name,task,folders] of groups){
  const check=checks.find(c=>'task' in c&&c.task===task);const files:Awaited<ReturnType<typeof inventory>>=[];
  if(check?.status==='PASS')for(const folder of folders)files.push(...await inventory(`${out}/${folder}`));
  const required=name==='server'?['api/main.js','worker/main.js','worker/tool-gateway/mcp-main.js','worker/lifecycle/reaper-main.js','worker/lifecycle/media-maintenance-main.js','worker/lifecycle/privacy-journal-main.js']
    :name==='preview'?['preview/index.html','preview/support.html','preview/review.html']:[`${name==='alipay'?'mini-alipay':'mini-douyin'}/app.json`,`${name==='alipay'?'mini-alipay':'mini-douyin'}/app.js`];
  const status=check?.status==='PASS'&&required.some(path=>!files.some(f=>f.path===`${out}/${path}`))?'MISSING_OUTPUT':check?.status??'NOT_RUN';
  components.push({name,status,files:status==='PASS'?files:[]});
}
const typePassed=checks.find(c=>'task' in c&&c.task==='typecheck')?.status==='PASS';
const buildPassed=typePassed&&components.every(c=>c.status==='PASS');
const selectedPassed=typePassed&&(serverOnly?components.find(c=>c.name==='server')?.status==='PASS':skipMini?components.filter(c=>['server','preview'].includes(c.name)).every(c=>c.status==='PASS'):buildPassed);
const report={schema_version:'1.0',checked_at:new Date().toISOString(),id,build_root:out,source_set_hash:before.source_set_hash,
 mini_api_configuration:process.env.TARO_APP_API_BASE?'EXPLICIT_ORIGIN_UNVERIFIED':'LOOPBACK_DEVELOPMENT_DEFAULT_REBUILD_FOR_DEVICE',
 files:before.files,runtime_contract_files:before.runtime_contract_files,resource_files:before.resource_files,
 strategy:'USER_REQUESTED_FOCUSED_DELIVERY',build_selection:serverOnly?'SERVER_ONLY':skipMini?'SERVER_AND_PREVIEW':'ALL',full_suite_executed:false,full_suite_required_for_packaging:false,
 checks,components,builds_passed:buildPassed,selected_builds_passed:selectedPassed,full_product_verified:false,production_admitted:false,cloud_deployed:false};
await json(`${base}/result.json`,report);await json('docs/delivery/current.json',report);
const previous=JSON.parse(await readFile('assets/implementation/current.json','utf8')) as Record<string,unknown>;
function resetClaims(value:unknown):unknown{
  if(Array.isArray(value))return value.map(resetClaims);
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,v])=>[key,/fixture_verified$/.test(key)?false:resetClaims(v)]));
  return value;
}
await json('assets/implementation/current.json',{...resetClaims(previous) as Record<string,unknown>,checked_at:report.checked_at,
 verification_mode:'FOCUSED_DELIVERY',historical_full_chain:'docs/verification/repair-cost-native-source.json',retained_integration:null,
 ...before,source_files:before.files.length,command_checks_passed:false,delivery_builds_passed:buildPassed,
 full_suite_executed:false,commands:checks,suites:[],full_product_verified:false,production_admitted:false,cloud_deployed:false});
console.log(JSON.stringify({id,builds_passed:buildPassed,selected_builds_passed:selectedPassed,components:components.map(({name,status})=>({name,status})),report:'docs/delivery/current.json'}));
if(!selectedPassed)process.exitCode=1;
