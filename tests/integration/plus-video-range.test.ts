import {beforeAll,afterAll,it,expect} from 'vitest';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import sharp from 'sharp';
import {plusVideoFixture} from '../helpers/plus-video';
import {verifyPlusVideoEvidence} from '../../src/worker/review/plus-video';
import {extractEvidenceFrames,requiredEvidenceFrameIndices} from '../../src/worker/review/evidence';
import {nativeCommand,inspectVideo} from '../../src/worker/media/native';
import {addSeconds,id} from '../../src/api/lib/crypto';
import type {DTO} from '../../src/shared/contracts/types';
import type {ReviewEvidence} from '../../src/worker/review/qc';

let f:Awaited<ReturnType<typeof plusVideoFixture>>,session:DTO<'PlusBrowserSession'>,draft:DTO<'PlusVideoDraft'>,plan:DTO<'PlusVideoRenderPlan'>;
beforeAll(async()=>{f=await plusVideoFixture({sourceFrames:3600,sourceWidth:320,sourceHeight:400});session=await f.connect(false,true);},120000);
afterAll(async()=>{await f?.close();});
const call=(path:string,method:'GET'|'POST'|'PUT'|'DELETE'='GET',body?:unknown,native=false)=>f.call(path,method,body,native?f.buyer.accessToken:session.access_token);

it('preserves absolute non-second trim indices and ignores scenes outside the confirmed source range',async()=>{
  const directory=join(f.cfg.runtimeRoot,'range-extraction',id('native'));await mkdir(directory,{recursive:true});
  const path=join(directory,'colors.mp4');
  await nativeCommand(f.cfg,process.env.FFMPEG_PATH?.trim()||'ffmpeg',['-v','error','-nostdin','-threads','2','-f','lavfi','-i','color=red:s=64x64:r=30:d=1',
    '-f','lavfi','-i','color=blue:s=64x64:r=30:d=1','-f','lavfi','-i','color=green:s=64x64:r=30:d=1',
    '-filter_complex_threads','1','-filter_complex','[0:v][1:v][2:v]concat=n=3:v=1:a=0[v]','-map','[v]','-c:v','libx264','-threads','2','-pix_fmt','yuv420p',path],{cwd:directory,timeoutMs:30000});
  const signal=new AbortController().signal;
  const selected=await extractEvidenceFrames(f.cfg,path,join(directory,'selected'),90,[30,44,59],addSeconds(60),signal,{start_frame:17,end_frame:60});
  expect(selected.map(x=>x.index)).toEqual([17,30,44,47,59]);
  expect(selected.every(x=>x.timeMs===Math.round(x.index*1000/30))).toBe(true);
  const first=await sharp(selected[0]!.bytes).raw().toBuffer(),blue=await sharp(selected.find(x=>x.index===30)!.bytes).raw().toBuffer();
  expect(first[0]).toBeGreaterThan(240);expect(first[2]).toBeLessThan(10);expect(blue[2]).toBeGreaterThan(240);expect(blue[0]).toBeLessThan(10);
  const full=await extractEvidenceFrames(f.cfg,path,join(directory,'full'),90,[],addSeconds(60),signal);
  expect(full.map(x=>x.index)).toEqual([0,30,60,89]);
  await expect(extractEvidenceFrames(f.cfg,path,join(directory,'invalid'),90,[],addSeconds(60),signal,{start_frame:89,end_frame:91})).rejects.toMatchObject({code:'REVIEW_RANGE_INVALID'});
});

it('rejects known impossible image, token and pixel capacity before creating a quote',async()=>{
  const created=await call('/plus/video-drafts','POST',{order_id:f.originalId,deliverable_id:f.artifactId});expect(created.statusCode,created.body).toBe(200);draft=created.json().data;
  const saved=await call(`/plus/video-drafts/${draft.draft_id}`,'PUT',{expected_revision:1,settings:{...draft.settings,canvas:{width:640,height:960},trim:{start_frame:3017,end_frame:3077},audio_mode:'MUTE',captions:[{start_frame:1,end_frame:58,text:'蓝色杯身',kind:'ON_SCREEN_COPY'}]}});
  expect(saved.statusCode,saved.body).toBe(200);draft=saved.json().data;
  const made=await call(`/plus/video-drafts/${draft.draft_id}/render-plans`,'POST',{expected_revision:draft.revision,variant_id:'minimal-clean.photo-layout',variant_version:'3.1.0'});expect(made.statusCode,made.body).toBe(200);
  await f.step('PLAN');plan=(await call(`/plus/video-render-plans/${made.json().data.request_id}`)).json().data;
  const original=(await f.db.pool.query('SELECT private FROM plan_versions WHERE id=$1',[plan.plan.plan_id])).rows[0].private.runtime_admission;
  const request={plan_id:plan.plan.plan_id,plan_hash:plan.plan.plan_hash};
  for(const vision of [{...original.review_vision,max_images:2},{...original.review_vision,tokens_per_image_bound:1000000},{...original.review_vision,max_image_pixels:100000}]){
    await f.db.pool.query("UPDATE plan_versions SET private=jsonb_set(private,'{runtime_admission,review_vision}',$2::jsonb) WHERE id=$1",[plan.plan.plan_id,JSON.stringify(vision)]);
    const quote=await call('/quotes','POST',request,true);expect(quote.statusCode,quote.body).toBe(422);expect(quote.json().code).toMatch(/^PLUS_VIDEO_REVIEW_(CAPACITY|PIXELS)_EXCEEDED$/);
  }
  expect((await f.db.pool.query('SELECT id FROM quotes WHERE plan_id=$1',[plan.plan.plan_id])).rowCount).toBe(0);
  await f.db.pool.query("UPDATE plan_versions SET private=jsonb_set(private,'{runtime_admission}',$2::jsonb) WHERE id=$1",[plan.plan.plan_id,JSON.stringify(original)]);
});

it('delivers a short selection from a 120-second source and seals complete selected references without altering the original',async()=>{
  const q=await call('/quotes','POST',{plan_id:plan.plan.plan_id,plan_hash:plan.plan.plan_hash},true);expect(q.statusCode,q.body).toBe(201);
  const made=await call('/orders','POST',{quote_id:q.json().data.quote_id,channel:'alipay'},true);expect(made.statusCode,made.body).toBe(201);const order=made.json().data as DTO<'Order'>;await f.pay(order);
  for(const stage of ['PRODUCTION','POST','QC','REVIEW_FACTS','REVIEW_STYLE','DELIVER'] as const)await f.step(stage);
  const pack=(await call(`/orders/${order.order_id}/deliverables`)).json().data as DTO<'Deliverables'>;
  const video=pack.items.find(x=>x.kind==='video')!,artifact=(await f.db.pool.query('SELECT object_key FROM artifacts WHERE id=$1',[video.deliverable_id])).rows[0];
  const path=join(f.cfg.runtimeRoot,'range-result.mp4');await writeFile(path,await f.store.get(artifact.object_key));
  expect(await inspectVideo(f.cfg,path)).toMatchObject({frames:60,hasAudio:false,width:640,height:960});
  const rows=(await f.db.pool.query('SELECT * FROM review_evidence WHERE order_id=$1',[order.order_id])).rows as ReviewEvidence[];
  const references=rows.filter(r=>r.data.purpose==='PLUS_VIDEO_SOURCE_REFERENCE').sort((a,b)=>a.frame_index!-b.frame_index!);
  const required=requiredEvidenceFrameIndices(3600,[3018,3046,3074],draft.settings.trim);
  expect(references.map(r=>r.frame_index)).toEqual(required);expect(required).toHaveLength(6);
  expect(references.every(r=>r.frame_index!>=3017&&r.frame_index!<3077)).toBe(true);
  expect(rows.filter(r=>r.kind==='VIDEO_FRAME').some(r=>r.frame_index===59)).toBe(true);
  const buffers=new Map<string,Buffer>();for(const row of rows)buffers.set(row.id,await f.store.get(row.object_key));
  const packet=(await f.db.pool.query('SELECT data FROM review_packets WHERE order_id=$1',[order.order_id])).rows[0].data as DTO<'ReviewPacket'>;
  expect(()=>verifyPlusVideoEvidence(packet,rows,buffers)).not.toThrow();
  const report=JSON.parse(buffers.get(rows.find(r=>r.kind==='AUDIO_QC')!.id)!.toString());expect(report.version).toBe('YPCC-PLUS-VIDEO-EVIDENCE-2');expect(report.source_review.range).toEqual(draft.settings.trim);
  const changed=structuredClone(rows);changed.find(r=>r.id===references[0]!.id)!.frame_index=0;
  expect(()=>verifyPlusVideoEvidence(packet,changed,buffers)).toThrow();
  expect(()=>verifyPlusVideoEvidence(packet,rows.filter(r=>r.id!==references[1]!.id),buffers)).toThrow();
  expect((await call(`/orders/${f.originalId}/deliverables`)).json().data).toEqual(f.pack);expect(await readFile(f.sourcePath)).toEqual(f.sourceVideo);
  expect(f.listenCount()).toBe(0);expect((await f.db.pool.query("SELECT id FROM agent_instances WHERE state='ACTIVE'")).rowCount).toBe(0);
});
