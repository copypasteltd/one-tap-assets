import {access,readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {basename} from 'node:path';
import {config} from '../../src/api/config.js';
import {createPool} from '../../src/api/db/pool.js';
import {local,json} from './common.js';
const rows:{id:string;status:string;detail:string}[]=[];
function row(id:string,status:string,detail:string){rows.push({id,status,detail});}
row('node',Number(process.versions.node.split('.')[0])===24?'PASS':'MISSING',process.versions.node);
for(const path of ['runtime/tools/package-manager/node_modules/pnpm/bin/pnpm.cjs','assets/presets/presets.v3.1.json']){
  try{await access(local(path));row(path,'PASS','present');}catch{row(path,'MISSING','Run bootstrap-native.ps1 and install --frozen-lockfile');}
}
try{
  const cfg=config();row('configuration','PASS',`environment=${cfg.env}; private values omitted`);
  const pool=createPool(cfg);
  try{await pool.query('SELECT 1');const n=await pool.query('SELECT count(*)::int AS n FROM schema_migrations');row('database','PASS',`connected; ${n.rows[0].n} migrations`);}
  catch(error){const code=String((error as {code?:unknown}).code??'UNAVAILABLE');row('database','MISSING',`Run scripts/setup-local.ps1; native status=${/^[A-Z0-9_]{1,30}$/.test(code)?code:'UNAVAILABLE'}`);}finally{await pool.end();}
  for(const [name,path] of [['ffmpeg',process.env.FFMPEG_PATH],['ffprobe',process.env.FFPROBE_PATH]]){
    try{const executable=path?.trim()||name!;if(!new RegExp(`^${name}(?:\\.exe)?$`,'i').test(basename(executable)))throw new Error();execFileSync(executable,['-version'],{cwd:process.cwd(),windowsHide:true,stdio:'ignore',timeout:5000});row(name!,'PASS',path?'Configured native executable responds':'Native executable on PATH responds');}
    catch{row(name!,'MISSING','Install native FFmpeg/ffprobe on PATH or configure their paths in .env.local');}
  }
  for(const [name,on] of [['generation',cfg.generationEnabled],['codex',cfg.codex.enabled],['payments',cfg.paymentsEnabled],['community-publishing',cfg.publishingEnabled]] as const)
    row(name,on?'CONFIGURED_NOT_CERTIFIED':'OFF',on?'Enabled configuration; verify the corresponding provider and admission':'External service remains disabled');
  if(cfg.codex.enabled)for(const [name,path] of [['codex-runtime',cfg.codex.binary],['native-launcher',cfg.codex.isolationCommand],['codex-admission',cfg.codex.admissionPath]]){
    try{if(!path)throw new Error();await access(local(path));row(name!,'PRESENT_NOT_CERTIFIED','Configured project-local file exists');}catch{row(name!,'MISSING','Required configured runtime file is unavailable');}
  }
}catch{row('configuration','MISSING','Run local:setup; keep real configuration in .env.local');}
for(const [name,path] of [['server','runtime/build/api/main.js'],['preview','runtime/build/preview/index.html'],['alipay','runtime/build/mini-alipay/app.json'],['douyin','runtime/build/mini-douyin/app.json']]){
  try{await access(local(path!));row(name!,'PRESENT_NOT_CERTIFIED','Existing default output; delivery:build records fresh isolated outputs');}catch{row(name!,'NOT_BUILT','Run delivery:build');}
}
const presets=JSON.parse(await readFile('assets/presets/presets.v3.1.json','utf8')) as {presets:{execution_variants:unknown[]}[]};
row('catalog','PASS',`${presets.presets.length} official presets; ${presets.presets.reduce((n,p)=>n+p.execution_variants.length,0)} variants`);
const report={checked_at:new Date().toISOString(),scope:'LOCAL_SETUP_NOT_PRODUCTION_ADMISSION',rows,full_product_verified:false,production_admitted:false};
await json('runtime/delivery/doctor.json',report);console.log(JSON.stringify(report,null,2));
if(rows.some(r=>r.status==='MISSING'))process.exitCode=1;
