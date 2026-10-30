import {mkdir,rm} from 'node:fs/promises';
import {join} from 'node:path';
import sharp from 'sharp';
import {testDatabase,account} from './database.js';
import {rawProfile} from './fixtures.js';
import {config,inside} from '../../src/api/config.js';
import {buildApp} from '../../src/api/app.js';
import {LocalStorage} from '../../src/api/storage/storage.js';
import {writePrivateObject} from '../../src/api/storage/private-objects.js';
import {createProduct} from '../../src/api/modules/products.js';
import {compilePresetConfig} from '../../src/api/modules/community.js';
import {normalizeVision} from '../../src/worker/analysis/profile.js';
import {insert} from '../../src/api/db/store.js';
import {hash,id,sha256} from '../../src/api/lib/crypto.js';
import type {DTO} from '../../src/shared/contracts/types.js';
import {nativeCommand} from '../../src/worker/media/native.js';
import {claimStage,completeStage} from '../../src/worker/queue/leases.js';
import {PublicSamplePreparationService} from '../../src/worker/samples/publication.js';
import {readFile} from 'node:fs/promises';

/** Explicit synthetic author/rights/READY-QC input for the operator UI, not a
 * production SAMPLE run or commercial admission. HTTP, database, uploads,
 * PNG/MP4 reads and independent public-copy effects are real native effects. */
export async function reviewDeskEnvironment(){
  const db=await testDatabase(),folder=inside(db.cfg.runtimeRoot,`tests/review-desk/${id('case')}`);await mkdir(folder,{recursive:true});
  const token=id('synthetic-review-token'),cfg=config({...db.cfg,runtimeRoot:folder,publishingEnabled:true,
    managementTokens:JSON.stringify([{actor:'synthetic-review-operator',token_hash:sha256(token),permissions:['moderator:review','moderator:publish']}])});
  const store=new LocalStorage(cfg),app=await buildApp({cfg,pool:db.pool,storage:store,tls:false}),author=await account(db),p=author.principal;
  const api=async(path:string,body:unknown)=>{const response=await app.inject({method:'POST',url:'/v1/p01'+path,
    headers:{authorization:`Bearer ${author.accessToken}`,'idempotency-key':id('record'),'content-type':'application/json'},payload:JSON.stringify(body)});if(response.statusCode>=300)throw new Error(`Review fixture ${path}: ${response.statusCode} ${response.body}`);return response.json().data;};
  const managed=async(path:string,body:unknown)=>{const response=await app.inject({method:'POST',url:'/v1/internal/p01'+path,
    headers:{authorization:`Bearer ${token}`,'idempotency-key':id('review'),'content-type':'application/json'},payload:JSON.stringify(body)});if(response.statusCode!==200)throw new Error(`Review fixture management ${path}: ${response.statusCode} ${response.body}`);return response.json().data;};
  try{
    const product=await createProduct(db.pool,p),photoId=id('photo-set');
    const {profile,identityLock}=normalizeVision(rawProfile(),{tenantId:p.tenantId,productId:product.product_id,photoVersion:1,revision:1,assetIds:['asset-a','asset-b','asset-c']});
    await insert(db.pool,'product_photo_versions',{id:photoId,tenant_id:p.tenantId,product_id:product.product_id,revision:1,photo_set_hash:'a'.repeat(64),data:[]});
    await insert(db.pool,'profile_versions',{id:profile.profile_id,tenant_id:p.tenantId,owner_id:p.userId,product_id:product.product_id,photo_version_id:photoId,revision:1,profile_hash:profile.profile_hash,data:profile});
    await insert(db.pool,'identity_locks',{id:identityLock.identity_lock_id,tenant_id:p.tenantId,profile_id:profile.profile_id,hash:identityLock.content_hash,data:identityLock});
    await db.pool.query("UPDATE product_drafts SET current_profile_id=$2,current_photo_version=1,data=data||jsonb_build_object('profile_id',$2::text,'photo_version',1) WHERE id=$1",[product.product_id,profile.profile_id]);
    const terms=await managed('/preset-licenses',{license_id:id('fixture-license'),version:'1.0.0',name:'审核演示许可 · 合成资料',full_text:'本许可仅用于审核工作台的合成资料展示，不构成真实商品、人物、声音或商业资源授权。允许演示方案在测试范围内派生，真实发布仍需独立权利审查。',fork_allowed:true,attribution_required:true}) as DTO<'PresetLicense'>;
    await managed(`/preset-licenses/${terms.license_id}/decision`,{expected_state:'DRAFT',expected_content_hash:terms.content_hash,decision:'APPROVE',review_reference:'SYNTHETIC-UI-ONLY',reason:'审核工作台合成许可，不代表生产准入'});
    const png=await sharp(Buffer.from('<svg width="640" height="800" xmlns="http://www.w3.org/2000/svg"><rect width="640" height="800" fill="#eef3dd"/><circle cx="320" cy="300" r="170" fill="#d1dfaa"/><rect x="240" y="220" width="160" height="310" rx="42" fill="#f9fbf4" stroke="#45623e" stroke-width="6"/><rect x="275" y="185" width="90" height="55" rx="10" fill="#45623e"/><path d="M270 375 Q320 325 370 375 Q320 425 270 375" fill="#a7be6a"/></svg>')).png().toBuffer();
    const upload=await api('/assets',{purpose:'RIGHTS_EVIDENCE',file_name:'synthetic-proof.png',mime_type:'image/png',size_bytes:png.length,sha256:sha256(png)}) as DTO<'UploadGrant'>;
    const wrote=await app.inject({method:'PUT',url:new URL(upload.upload_url).pathname,headers:{...upload.headers,'content-type':'application/octet-stream'},payload:png});if(wrote.statusCode!==204)throw Error('Fixture proof upload failed');
    await api(`/assets/${upload.asset_id}/complete`,{sha256:sha256(png)});
    const rights:DTO<'RightsRecord'>[]=[];
    for(const scope of ['OWNED_PRODUCT','SAMPLE_PUBLICATION'])rights.push(await api('/rights-records',{scope,product_id:product.product_id,statement:`审核演示合成声明：${scope==='OWNED_PRODUCT'?'拥有测试商品资料的使用权':'同意将独立样例副本公开最多30天，可随时撤回'}。不构成真实商业授权。`,evidence_asset_ids:[upload.asset_id]}));
    const preset:DTO<'PresetConfig'>={name:'柚子留白 · 商品展示',description:'这是一份审核工作台演示方案。样例、授权和身份为合成资料；上传、文件读取、审核决定与发布副本使用实际本地服务。',style_tags:['静谧','留白'],parent_preset_version:null,component_versions:['style.quiet-luxury.1'],variant_blueprint_ids:['blueprint.minimal-clean.photo-layout'],resource_version_ids:[],fork_allowed:true};
    const draft=await api('/preset-drafts',{config:preset}) as DTO<'PresetDraft'>,compiled=(await compilePresetConfig(db.pool,preset))[0]!,sampleId=id('sample');
    const path=join(folder,'synthetic-sample.mp4');await nativeCommand(cfg,process.env.FFMPEG_PATH?.trim()||'ffmpeg',['-v','error','-f','lavfi','-i','testsrc2=s=360x640:r=30:d=2','-frames:v','60','-c:v','libx264','-threads','2','-pix_fmt','yuv420p','-an','-y',path],{cwd:folder,timeoutMs:30000});
    const media=[];for(const [item,kind,bytes] of [['hero','image',png],['clip','video',await readFile(path)]] as const){
      const key=`${p.tenantId}/samples/${sampleId}/${item}.${kind==='image'?'png':'mp4'}`;await writePrivateObject(db.pool,store,{tenantId:p.tenantId,ownerId:p.userId,productId:product.product_id,kind:'MEDIA'},key,bytes,kind==='image'?'image/png':'video/mp4');
      media.push({item_id:item,kind,object_key:key,sha256:sha256(bytes),size_bytes:bytes.length});
    }
    const sample:DTO<'Sample'>={sample_id:sampleId,draft_id:draft.draft_id,state:'READY',visibility:'PRIVATE',rights_verified:false,draft_revision:draft.revision,product_id:product.product_id,variant_blueprint_id:preset.variant_blueprint_ids[0]!};
    const rightsIds=rights.map(r=>r.rights_record_id),sampleRequest:DTO<'SampleRequest'>={draft_revision:draft.revision,product_id:product.product_id,profile_id:profile.profile_id,variant_blueprint_id:sample.variant_blueprint_id!,rights_record_ids:rightsIds};
    await insert(db.pool,'public_samples',{id:sampleId,tenant_id:p.tenantId,owner_id:p.userId,product_id:product.product_id,draft_id:draft.draft_id,state:'READY',visibility:'PRIVATE',data:sample,
      private:{request:sampleRequest,config:preset,config_hash:hash(preset),compiled_source_hash:compiled.source_hash,input_ref:{product_id:product.product_id,photo_version:1},qc_passed:true,test_fixture:true,media}});
    const publication=await api(`/preset-drafts/${draft.draft_id}/submit`,{expected_revision:draft.revision,sample_ids:[sampleId],rights_record_ids:rightsIds,accept_license:true,
      license_version:terms.license_id,license_content_hash:terms.content_hash,accept_sample_publication:true,public_sample_retention_days:30} satisfies DTO<'PublicationRequest'>) as DTO<'Publication'>;
    return {db,cfg,store,app,token,author,publication,async prepare(){const lease=await claimStage(db.pool,id('review-copy'),['PUBLIC_SAMPLE_PREPARE']);if(!lease||lease.scope_id!==publication.publication_id)throw Error('Original public copy stage missing');
      await completeStage(db.pool,lease,await new PublicSamplePreparationService(db.pool,cfg,store).handle(lease,new AbortController().signal));},
      async close(){await app.close();await db.close();await rm(inside(db.cfg.runtimeRoot,folder),{recursive:true,force:true});}};
  }catch(error){await app.close();await db.close();await rm(inside(db.cfg.runtimeRoot,folder),{recursive:true,force:true});throw error;}
}
