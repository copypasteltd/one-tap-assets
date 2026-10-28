import {execFileSync} from 'node:child_process';
import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import {resolve,dirname,relative,isAbsolute} from 'node:path';
import {existsSync} from 'node:fs';
import {sha256} from '../src/api/lib/crypto.js';
import sharp from 'sharp';

const root=process.cwd();
const check=(condition:unknown,message:string):void=>{if(!condition)throw new Error(message);};
const guides=['README.md','README.en.md','docs/README.md','docs/guides/QUICKSTART.md',
  'docs/guides/QUICKSTART.en.md','docs/guides/ARCHITECTURE.md','docs/guides/DEMO.md',
  'docs/guides/STATUS.md','CHANGELOG.md','CONTRIBUTING.md','THIRD_PARTY_NOTICES.md'];
let links=0;
for(const path of guides){
  const body=await readFile(path,'utf8');check(body.length>150,`Empty documentation: ${path}`);
  // Local file links in the publication entry points, including escaped spaces
  // and fragments. External links/anchors are intentionally not network probes.
  for(const match of body.matchAll(/!?\[[^\]\n]*\]\((?:<([^>]+)>|([^\s)]+))(?:\s+"[^"]*")?\)/g)){
    const target=(match[1]??match[2]??'').split('#')[0]!.split('?')[0]!;
    if(!target||/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(target))continue;
    const full=resolve(dirname(resolve(path)),decodeURIComponent(target));
    check(!relative(root,full).startsWith('..')&&!isAbsolute(relative(root,full)),`Outside link: ${path}`);
    check(existsSync(full),`Broken local link: ${path} -> ${target}`);links++;
  }
}
const manifest=JSON.parse(await readFile('docs/media/capture-manifest.json','utf8')) as {
  type:string;data_source:string;native_mini_device_verified:boolean;real_generation_verified:boolean;
  real_payment_verified:boolean;browser_tabs_closed:boolean;browser_errors:unknown[];external_network_requests:unknown[];
  screenshots:{path:string}[];files:{path:string;bytes:number;sha256:string}[];
};
check(manifest.type==='ACTUAL_BROWSER_RECORDING_SHARED_MINI_PAGES'&&manifest.data_source==='SYNTHETIC_LOCAL_FIXTURES','Media provenance missing');
check(!manifest.native_mini_device_verified&&!manifest.real_generation_verified&&!manifest.real_payment_verified,'Demo cannot certify production');
check(manifest.browser_tabs_closed&&!manifest.browser_errors.length&&!manifest.external_network_requests.length,'Browser capture errors or cleanup missing');
check(manifest.screenshots.length===10,'Expected ten actual page screenshots');
for(const file of manifest.files){
  check(file.path.startsWith('docs/media/')&&!file.path.includes('..'),'Unsafe media path');
  const bytes=await readFile(file.path);check(bytes.length===file.bytes&&sha256(bytes)===file.sha256,`Changed media: ${file.path}`);
}
for(const s of manifest.screenshots){const m=await sharp(s.path).metadata();check(m.width===430&&m.height===932,`Wrong page size: ${s.path}`);}
const gif=await sharp('docs/media/walkthrough.gif',{animated:true}).metadata();check((gif.pages??0)>1,'GIF is not animated');
const audio=JSON.parse(await readFile('docs/media/native-audio/capture-manifest.json','utf8')) as {
  type:string;data_source:string;browser_used:boolean;real_speech_verified:boolean;real_asr_verified:boolean;
  order_pipeline_connected:boolean;production_admitted:boolean;full_product_verified:boolean;
  source_files:{path:string;sha256:string}[];files:{path:string;sha256:string;bytes:number}[];
  styles:{style:string;output_sha256:string;semantic_review:string;order_pipeline_connected:boolean}[];gif_frames:number;
};
check(audio.type==='NATIVE_AUDIO_KERNEL_SYNTHETIC_FIXTURE'&&audio.data_source==='SYNTHETIC_SINE_TONES_AND_MANUAL_TIMESTAMPS',
  'Audio kernel fixture provenance missing');
check(!audio.browser_used&&!audio.real_speech_verified&&!audio.real_asr_verified&&!audio.order_pipeline_connected
  &&!audio.production_admitted&&!audio.full_product_verified,'Audio fixture cannot certify speech, ASR or delivery');
check(audio.styles.length===4&&new Set(audio.styles.map(s=>s.style)).size===4,'Four caption fixture styles required');
for(const file of audio.files){
  check(file.path.startsWith('docs/media/native-audio/')&&!file.path.includes('..'),'Unsafe audio fixture path');
  const bytes=await readFile(file.path);check(bytes.length===file.bytes&&sha256(bytes)===file.sha256,`Changed audio media: ${file.path}`);
}
for(const file of audio.source_files)check(sha256(await readFile(file.path))===file.sha256,`Stale audio capture source: ${file.path}`);
for(const style of audio.styles)check(style.semantic_review==='NOT_PERFORMED'&&!style.order_pipeline_connected
  &&audio.files.some(f=>f.path===`docs/media/native-audio/${style.style}.mp4`&&f.sha256===style.output_sha256),'Audio fixture style evidence mismatch');
const audioGif=await sharp('docs/media/native-audio/preview.gif',{animated:true}).metadata();
check((audioGif.pages??0)>1&&audioGif.pages===audio.gif_frames,'Audio fixture GIF frame count mismatch');
const raw=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{encoding:'utf8',windowsHide:true});
const candidates=[...new Set(raw.split('\0').filter(Boolean))];
let bytes=0;
for(const file of candidates){
  check(!/^(?:runtime|output|node_modules|\.pnpm-store)\//.test(file),`Private runtime candidate: ${file}`);
  check(!/(?:^|\/)\.env(?:\.|$)/.test(file)||file==='.env.example',`Private environment candidate: ${file}`);
  const size=(await stat(file)).size;bytes+=size;check(size<95*1024*1024,`Oversized Git object: ${file}`);
  if(/\.(?:md|json|[cm]?js|tsx?|py|ps1|yaml|yml|txt|example|csv)$/.test(file)){
    const content=await readFile(file,'utf8');
    check(!/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(content),`Private key material in ${file}`);
    check(!/\bsk-(?:(?:proj|svcacct)-)?[A-Za-z0-9_-]{40,}\b/.test(content),`Potential live credential in ${file}`);
  }
}
for(const path of ['.env.local','runtime/publication-probe','node_modules/publication-probe','output/publication-probe'])
  check(execFileSync('git',['check-ignore',path],{encoding:'utf8',windowsHide:true}).trim()===path,`Missing ignore: ${path}`);
const implementation=JSON.parse(await readFile('assets/implementation/current.json','utf8')) as {
  command_checks_passed:boolean;full_product_verified:boolean;production_admitted:boolean;
  suites:{kind:string;tests:number;passed:number;failed:number}[];
  files:{path:string;sha256:string}[];runtime_contract_files:{path:string;sha256:string}[];resource_files:{path:string;sha256:string}[];
};
check(implementation.command_checks_passed&&!implementation.full_product_verified&&!implementation.production_admitted,'Current scope/evidence invalid');
for(const f of [...implementation.files,...implementation.runtime_contract_files,...implementation.resource_files])
  check(sha256(await readFile(f.path))===f.sha256,`Stale implementation evidence: ${f.path}`);
const report={schema_version:'1.0',checked_at:new Date().toISOString(),status:'PASS',
  scope:'Repository documentation/media/source snapshot checks; not real provider, payment, native device or production admission',
  documentation_files:guides.length,local_links:links,media_files:manifest.files.length+audio.files.length,screenshots:manifest.screenshots.length,
  audio_fixture_files:audio.files.length,audio_fixture_styles:audio.styles.length,audio_fixture_gif_frames:audioGif.pages,
  gif_frames:gif.pages,candidate_files:candidates.length,candidate_bytes:bytes,browser_closed:true,
  credential_check:'No private-key blocks or long OpenAI-style key strings in candidate text; not a guarantee for every possible secret format',
  implementation_evidence_sha256:sha256(await readFile('assets/implementation/current.json')),
  suites:implementation.suites.map(({kind,tests,passed,failed})=>({kind,tests,passed,failed})),
  source_files_verified:implementation.files.length,runtime_contract_files_verified:implementation.runtime_contract_files.length,
  resource_files_verified:implementation.resource_files.length,full_product_verified:false,production_admitted:false};
await mkdir('docs/verification',{recursive:true});await writeFile('docs/verification/publication.json',JSON.stringify(report,null,2)+'\n');
process.stdout.write(JSON.stringify(report,null,2)+'\n');
