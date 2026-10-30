import {readFile,writeFile} from 'node:fs/promises';
import {createWriteStream} from 'node:fs';
import {deflateRawSync} from 'node:zlib';
import {execFileSync} from 'node:child_process';
import {once} from 'node:events';
import {randomUUID} from 'node:crypto';
import {checked,directory,json,local,sha,snapshot,type FileEntry} from './common.js';
const report=JSON.parse(await readFile('docs/delivery/current.json','utf8')) as {
 id:string;build_root:string;source_set_hash:string;files:unknown;runtime_contract_files:unknown;resource_files:unknown;
 components:{name:string;status:string;files:FileEntry[]}[];checks:unknown;builds_passed:boolean;
};
const current=await snapshot();
for(const key of ['source_set_hash','files','runtime_contract_files','resource_files'] as const)
  if(JSON.stringify(current[key])!==JSON.stringify(report[key]))throw new Error('Build source or contracts changed; run delivery:build again');
if(!/^runtime\/delivery-builds\/[A-Za-z0-9T.-]+\/runtime\/build$/.test(report.build_root))throw new Error('Invalid owned build directory');
const candidates=[...new Set(execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{encoding:'utf8',windowsHide:true}).split('\0').filter(Boolean))];
const rootFiles=/^(?:README(?:\.[A-Za-z-]+)?\.md|AGENTS\.md|CHANGELOG\.md|CONTRIBUTING\.md|SECURITY\.md|THIRD_PARTY_NOTICES\.md|LICENSE(?:\.[A-Za-z]+)?|package\.json|pnpm-lock\.yaml|tsconfig\.json|vitest(?:\.integration)?\.config\.ts|\.gitignore|\.gitattributes|\.npmrc|\.env\.example)$/;
const source=candidates.filter(p=>(/^(src|scripts|tests|assets|docs)\//.test(p)||rootFiles.test(p))&&p!=='docs/delivery/package.json');
const files:{path:string;source:string;sha256:string;bytes:number}[]=[];
const secrets=[/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,/\bsk-(?:(?:proj|svcacct)-)?[A-Za-z0-9_-]{40,}\b/,/\bgh[pousr]_[A-Za-z0-9]{30,}\b/,/\bgithub_pat_[A-Za-z0-9_]{40,}\b/];
async function add(path:string,target:string,expected?:string){
  if(target.startsWith('/')||target.split('/').some(s=>s==='..'||s==='.git'||s.startsWith('.env')&&target!=='.env.example'))throw new Error('Private or unsafe archive entry');
  const bytes=await readFile(await checked(path));if(bytes.length>=95*1024*1024)throw new Error('Oversized delivery input');
  if(expected&&sha(bytes)!==expected)throw new Error('Build output changed after verification');
  if(/\.(?:md|json|tsx?|[cm]?js|py|ps1|ya?ml|txt|example|csv)$/.test(target)&&secrets.some(pattern=>pattern.test(bytes.toString('utf8'))))throw new Error(`Credential-like input excluded: ${target}`);
  files.push({path:target,source:path,sha256:sha(bytes),bytes:bytes.length});
}
for(const path of source.sort())await add(path,path);
for(const component of report.components.filter(c=>c.status==='PASS'))for(const file of component.files){
  if(!file.path.startsWith(report.build_root+'/'))throw new Error('Unexpected build entry');
  const suffix=file.path.slice(report.build_root.length+1);
  if(!/^(api|worker|preview|mini-alipay|mini-douyin)\//.test(suffix))throw new Error('Build is outside the deliverable roots');
  await add(file.path,`runtime/build/${suffix}`,file.sha256);
}
if(new Set(files.map(f=>f.path)).size!==files.length||files.length>=65534)throw new Error('Duplicate or excessive delivery entries');
// A documentation/evidence update can reuse the verified build. Each package
// still gets its own directory; never overwrite an earlier delivered archive.
const createdAt=new Date().toISOString(),packageId=createdAt.replace(/[:.]/g,'-')+'-'+randomUUID().slice(0,8);
const manifest={schema_version:'1.0',kind:'SOURCE_AND_AVAILABLE_BUILDS',id:report.id,package_id:packageId,created_at:createdAt,
 source_set_hash:report.source_set_hash,builds_passed:report.builds_passed,full_suite_executed:false,
 verification_strategy:'USER_REQUESTED_FOCUSED_DELIVERY',components:report.components.map(({name,status})=>({name,status})),
 requirements_preserved:58,full_product_verified:false,production_admitted:false,cloud_deployed:false,
 excluded:['.git','.env.local','node_modules','private media','databases','logs','service credentials','personal Codex profiles'],
 prerequisites:'Windows; native Node 24/pnpm/PostgreSQL/FFmpeg and external service configuration as documented. Not an offline installer.',
 files:files.map(({path,sha256,bytes})=>({path,sha256,bytes}))};
const out=`runtime/releases/one-tap-assets-${packageId}`;await directory(out);
const zipPath=`${out}/one-tap-assets-source-and-builds.zip`,output=createWriteStream(local(zipPath),{flags:'wx'});
let outputError:Error|undefined;output.on('error',error=>{outputError=error;});
const crcTable=Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function crc32(b:Buffer){let n=0xffffffff;for(const byte of b)n=crcTable[(n^byte)&255]!^(n>>>8);return (n^0xffffffff)>>>0;}
let offset=0;const central:Buffer[]=[];
async function write(bytes:Buffer){if(outputError)throw outputError;if(!output.write(bytes))await once(output,'drain');offset+=bytes.length;}
async function entry(name:string,bytes:Buffer){
  const filename=Buffer.from('one-tap-assets/'+name),compressed=/\.(zip|png|jpg|gif|mp4|webm|ttf|woff2)$/.test(name)?bytes:deflateRawSync(bytes);
  const method=compressed===bytes?0:8,crc=crc32(bytes),start=offset,header=Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50,0);header.writeUInt16LE(20,4);header.writeUInt16LE(0x800,6);header.writeUInt16LE(method,8);
  header.writeUInt16LE(0x21,12);header.writeUInt32LE(crc,14);header.writeUInt32LE(compressed.length,18);header.writeUInt32LE(bytes.length,22);header.writeUInt16LE(filename.length,26);
  await write(header);await write(filename);await write(compressed);
  const c=Buffer.alloc(46);c.writeUInt32LE(0x02014b50,0);c.writeUInt16LE(20,4);c.writeUInt16LE(20,6);c.writeUInt16LE(0x800,8);c.writeUInt16LE(method,10);
  c.writeUInt16LE(0x21,14);c.writeUInt32LE(crc,16);c.writeUInt32LE(compressed.length,20);c.writeUInt32LE(bytes.length,24);c.writeUInt16LE(filename.length,28);c.writeUInt32LE(start,42);
  central.push(Buffer.concat([c,filename]));
}
for(const file of files){const bytes=await readFile(await checked(file.source));if(sha(bytes)!==file.sha256)throw new Error('Source changed during packaging');await entry(file.path,bytes);}
await entry('DELIVERY-MANIFEST.json',Buffer.from(JSON.stringify(manifest,null,2)+'\n'));
const centralStart=offset;for(const item of central)await write(item);const end=Buffer.alloc(22);
end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(central.length,8);end.writeUInt16LE(central.length,10);end.writeUInt32LE(offset-centralStart,12);end.writeUInt32LE(centralStart,16);
await write(end);await new Promise<void>((done,fail)=>{output.once('error',fail);output.end(done);});
const digest=sha(await readFile(zipPath));await json(`${out}/manifest.json`,manifest);await writeFile(`${out}/SHA256SUMS`,`${digest}  one-tap-assets-source-and-builds.zip\n`);
const exported={schema_version:'1.0',created_at:manifest.created_at,id:report.id,package_id:packageId,source_set_hash:report.source_set_hash,archive_path:zipPath,
 archive_sha256:digest,archive_bytes:offset,source_files:source.length,build_files:files.length-source.length,components:manifest.components,
 manifest_path:`${out}/manifest.json`,full_suite_executed:false,full_suite_required_for_packaging:false,full_product_verified:false,production_admitted:false};
await json('docs/delivery/package.json',exported);console.log(JSON.stringify(exported,null,2));
