import type {Db} from '../db/pool.js';
import type {Config} from '../config.js';
import type {DTO,ManagementPrincipal} from '../../shared/contracts/types.js';
import type {ObjectStorage} from '../storage/storage.js';
import {audit,type RecordRow} from '../db/store.js';
import {hash,sha256} from '../lib/crypto.js';
import {notFound,requireThat} from '../lib/errors.js';
import {lockMediaOwner} from './media-access.js';
import {license} from './licenses.js';
import type {SampleObject} from './sample-evidence.js';
import {verifyCompletedSample} from '../../worker/samples/completion.js';

type Publication=RecordRow<DTO<'Publication'>>;
type Sample=RecordRow<DTO<'Sample'>>&{product_id:string;product_live:boolean};
function allowed(admin:ManagementPrincipal){requireThat(admin.permissions.has('moderator:review')||admin.permissions.has('*'),
  'MANAGEMENT_FORBIDDEN','当前管理身份无审核资料读取权限',403);}
async function context(db:Db,admin:ManagementPrincipal,publicationId:string){
  allowed(admin);
  const observed=(await db.query<Publication>('SELECT * FROM publications WHERE id=$1',[publicationId])).rows[0]??notFound();
  await lockMediaOwner(db,observed.tenant_id,observed.owner_id!);
  const row=(await db.query<Publication>('SELECT * FROM publications WHERE id=$1 FOR SHARE',[publicationId])).rows[0]??notFound();
  const request=row.private?.request as DTO<'PublicationRequest'>|undefined,config=row.private?.config as DTO<'PresetConfig'>|undefined;
  const samples=request?(await db.query<Sample>(`SELECT s.*,p.deleted_at IS NULL AND p.expires_at>now() AS product_live FROM public_samples s
    JOIN product_drafts p ON p.tenant_id=s.tenant_id AND p.owner_id=s.owner_id AND p.id=s.product_id
    WHERE s.tenant_id=$1 AND s.owner_id=$2 AND s.id=ANY($3) ORDER BY s.id FOR SHARE OF s,p`,[row.tenant_id,row.owner_id,request.sample_ids])).rows:[];
  const rights=request?(await db.query<RecordRow<DTO<'RightsRecord'>>>('SELECT * FROM rights_records WHERE tenant_id=$1 AND owner_id=$2 AND id=ANY($3) ORDER BY id FOR SHARE',
    [row.tenant_id,row.owner_id,request.rights_record_ids])).rows:[];
  const available=Boolean(request&&config&&!row.private?.media_revoked&&samples.length===request.sample_ids.length&&samples.length>0
    &&samples.every(s=>s.product_live&&s.data.state==='READY'&&!s.private?.media_revoked&&Array.isArray(s.private?.media))
    &&rights.length===request.rights_record_ids.length&&rights.every(r=>typeof r.private?.statement==='string'));
  return {row,request,config,samples,rights,available};
}
function files(sample:Sample):DTO<'PublicationReviewFile'>[]{
  const media=sample.private?.media as SampleObject[];
  requireThat(media.length>0&&media.length<=100&&new Set(media.map(m=>m.item_id)).size===media.length,'REVIEW_MEDIA_INVALID','原审核样例清单不完整',503);
  return media.map(m=>{
    requireThat(m.object_key.startsWith(`${sample.tenant_id}/samples/${sample.id}/`)&&['image','video'].includes(m.kind)
      &&/^[a-f0-9]{64}$/.test(m.sha256)&&Number.isSafeInteger(m.size_bytes)&&m.size_bytes>0&&m.size_bytes<=125000000,
    'REVIEW_MEDIA_INVALID','审核文件不属于原申请的独立样例',503);
    return {sample_id:sample.id,item_id:m.item_id,kind:m.kind,mime_type:m.kind==='image'?'image/png':'video/mp4',sha256:m.sha256,size_bytes:m.size_bytes};
  });
}
export async function getPublicationReview(db:Db,admin:ManagementPrincipal,publicationId:string,trace:string):Promise<DTO<'PublicationReviewDetail'>>{
  const c=await context(db,admin,publicationId);
  const result:DTO<'PublicationReviewDetail'>={publication:c.row.data,content_available:c.available,config:null,license:null,rights:[],samples:[]};
  if(c.available){
    result.config=c.config!;result.license=await license(db,c.request!.license_version);
    result.rights=c.rights.map(r=>({record:r.data,statement:r.private!.statement as string,license_reference:typeof r.private!.license_reference==='string'?r.private!.license_reference:null,
      evidence_asset_ids:Array.isArray(r.private!.evidence_asset_ids)?r.private!.evidence_asset_ids as string[]:[]}));
    result.samples=c.samples.map(s=>({sample:s.data,files:files(s)}));
  }
  await audit(db,c.row.tenant_id,admin.actor,'PUBLICATION_REVIEW_READ',publicationId,{revision:c.row.data.revision,available:c.available},trace);return result;
}
async function mediaBytes(db:Db,store:ObjectStorage,admin:ManagementPrincipal,c:Awaited<ReturnType<typeof context>>,
  item:{item_id:string;object_key:string;sha256:string;size_bytes:number;mime_type:'image/png'|'video/mp4';sample_id:string|null;rights_record_id:string|null},trace:string):Promise<DTO<'PublicationReviewMedia'>>{
  requireThat(c.available,'REVIEW_CONTENT_UNAVAILABLE','原申请资料已撤回或到期，请刷新审核记录',410);
  requireThat(Number.isSafeInteger(item.size_bytes)&&item.size_bytes>0&&item.size_bytes<=125000000,'REVIEW_MEDIA_INVALID','原审核文件超出读取范围',503);
  const registered=await db.query(`SELECT id FROM private_object_writes WHERE tenant_id=$1 AND owner_id=$2 AND object_key=$3 AND sha256=$4
    AND state='STORED' AND NOT delete_requested AND expires_at>now() FOR SHARE`,[c.row.tenant_id,c.row.owner_id,item.object_key,item.sha256]);
  requireThat(registered.rowCount===1,'REVIEW_CONTENT_UNAVAILABLE','原审核文件已撤回或到期',410);
  const bytes=await store.get(item.object_key,item.size_bytes);
  requireThat(bytes.length===item.size_bytes&&sha256(bytes)===item.sha256
    &&(item.mime_type==='image/png'?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):bytes.subarray(4,8).toString()==='ftyp'),
  'REVIEW_MEDIA_CHANGED','实际审核文件与原申请摘要不一致',410);
  await audit(db,c.row.tenant_id,admin.actor,'PUBLICATION_REVIEW_MEDIA_READ',c.row.id,{publication_revision:c.row.data.revision,
    sample_id:item.sample_id,rights_record_id:item.rights_record_id,item_id:item.item_id,sha256:item.sha256,config_hash:hash(c.config)},trace);
  return {publication_id:c.row.id,sample_id:item.sample_id,rights_record_id:item.rights_record_id,item_id:item.item_id,
    mime_type:item.mime_type,sha256:item.sha256,size_bytes:item.size_bytes,bytes_base64:bytes.toString('base64')};
}
export async function readPublicationReviewMedia(db:Db,cfg:Config,store:ObjectStorage,admin:ManagementPrincipal,
  publicationId:string,sampleId:string,itemId:string,trace:string):Promise<DTO<'PublicationReviewMedia'>>{
  const c=await context(db,admin,publicationId);requireThat(c.available,'REVIEW_CONTENT_UNAVAILABLE','原申请资料已撤回或到期',410);
  const sample=c.samples.find(s=>s.id===sampleId)??notFound();const spec=files(sample).find(m=>m.item_id===itemId)??notFound();
  await verifyCompletedSample(db,cfg,sample.tenant_id,sampleId,sample.private!);
  const original=(sample.private!.media as SampleObject[]).find(m=>m.item_id===itemId)!;
  return mediaBytes(db,store,admin,c,{...spec,object_key:original.object_key,rights_record_id:null},trace);
}
export async function readPublicationRightsEvidence(db:Db,store:ObjectStorage,admin:ManagementPrincipal,
  publicationId:string,rightsId:string,assetId:string,trace:string):Promise<DTO<'PublicationReviewMedia'>>{
  const c=await context(db,admin,publicationId);requireThat(c.available,'REVIEW_CONTENT_UNAVAILABLE','原申请资料已撤回或到期',410);
  const right=c.rights.find(r=>r.id===rightsId)??notFound();
  requireThat(Array.isArray(right.private?.evidence_asset_ids)&&right.private.evidence_asset_ids.includes(assetId),'NOT_FOUND','当前申请未包含这张授权证明',404);
  const asset=(await db.query<{object_key:string;sha256:string;size_bytes:number}>(`SELECT object_key,sha256,size_bytes FROM assets
    WHERE tenant_id=$1 AND owner_id=$2 AND id=$3 AND purpose='RIGHTS_EVIDENCE' AND state='READY' AND expires_at>now() FOR SHARE`,
    [c.row.tenant_id,c.row.owner_id,assetId])).rows[0]??notFound();
  return mediaBytes(db,store,admin,c,{...asset,item_id:assetId,mime_type:'image/png',sample_id:null,rights_record_id:rightsId},trace);
}
