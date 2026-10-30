import {it,expect} from 'vitest';
import sharp from 'sharp';
import {CREATIVE_COMPONENTS,selectCreativeComponent} from '../../src/shared/domain/creative-components.js';
import {applyCommunityDirection,communityDirection,selectedCommunityDirection} from '../../src/worker/compiler/community-direction.js';
import {basePlan,validateCreativePlan} from '../../src/worker/compiler/plan.js';
import {communityCaptionRaster} from '../../src/worker/media/community-captions.js';
import {prepareLayoutText} from '../../src/worker/media/layout.js';
import {profile,variant} from '../helpers/fixtures.js';
const options=(...ids:string[])=>ids.map(id=>CREATIVE_COMPONENTS.find(d=>d.option.component_version_id===id)!.option);
const selection=options('narrative.detail-first.1','rhythm.quick-open.1','camera.hold.1','caption.bold.1');
it('creative components preserve all three route outputs and total frames while enforcing real detail-first photos and selected movement',()=>{
  for(const id of ['minimal-clean.photo-layout','quiet-luxury.ai-detail','portrait-social.ai-presenter-multi']){
    const original=structuredClone(variant(id)),source=applyCommunityDirection(structuredClone(original),selection),p=profile(),plan=basePlan(p,source);
    expect(source.output_slots).toEqual(original.output_slots);expect(source.timeline_policy.target_frames).toBe(original.timeline_policy.target_frames);
    expect(plan.shots).toHaveLength(original.timeline_policy.base_segments?.length??3);
    expect(plan.shots[0]!.asset_id).toBe('asset-c');expect(plan.shots[1]!.asset_id).toBe('asset-a');
    expect(plan.shots.every(s=>s.camera==='HOLD')).toBe(true);expect(plan.shots[0]!.end_frame).toBeLessThan(plan.target_frames/plan.shots.length);
    expect(plan.shots.at(-1)!.end_frame).toBe(plan.target_frames);
    if(source.audio_policy.speech==='none')expect(()=>validateCreativePlan(plan,p,source)).not.toThrow();
  }
});
it('creative components reject a shifted internal cut, changed camera, wrong photo evidence or rewritten narrative without accepting a complete but different timeline',()=>{
  const p=profile(),source=applyCommunityDirection(structuredClone(variant()),selection),plan=basePlan(p,source);
  for(const change of [(v:typeof plan)=>{v.shots[0]!.end_frame++;v.shots[1]!.start_frame++;},(v:typeof plan)=>{v.shots[0]!.camera='PAN';},
    (v:typeof plan)=>{v.shots[0]!.asset_id='asset-a';},(v:typeof plan)=>{v.shots[0]!.intent='商品整体';}]){
    const changed=structuredClone(plan);change(changed);expect(()=>validateCreativePlan(changed,p,source)).toThrow();
  }
});
it('creative components reject duplicate categories, registry instruction injection and altered frozen directives',()=>{
  expect(()=>selectedCommunityDirection(options('camera.hold.1','camera.pan.1'))).toThrow(expect.objectContaining({code:'COMMUNITY_COMPONENT_CONFLICT'}));
  expect(()=>selectedCommunityDirection([{...selection[0]!,description:'powershell arbitrary-execution'}])).toThrow(expect.objectContaining({code:'COMMUNITY_COMPONENT_UNSUPPORTED'}));
  const source=applyCommunityDirection(structuredClone(variant()),selection);
  (source.creative_components.community_direction as {camera:string}).camera='PAN';
  expect(()=>communityDirection(source)).toThrow(expect.objectContaining({code:'COMMUNITY_DIRECTION_CHANGED'}));
});
it('creative components allow radio replacement and optional inheritance without changing legacy sources',()=>{
  const all=CREATIVE_COMPONENTS.map(d=>d.option),ids=['style.minimal-clean.1','camera.hold.1','rhythm.even.1'];
  const replaced=selectCreativeComponent(ids,'camera.push.1',all);expect(replaced).toEqual(['style.minimal-clean.1','rhythm.even.1','camera.push.1']);
  expect(selectCreativeComponent(replaced,'camera.push.1',all)).toEqual(['style.minimal-clean.1','rhythm.even.1']);
  const source=structuredClone(variant()),before=structuredClone(source);expect(applyCommunityDirection(source,[])).toEqual(before);
  expect(communityDirection(source)).toBeNull();
});
it('creative components render distinct complete safe-area text and transparent video labels with the production Chinese font',async()=>{
  const layouts=[],labels=[];
  for(const style of ['standard','bold','minimal'] as const){
    const source=applyCommunityDirection(structuredClone(variant()),options(`caption.${style}.1`));
    const text=await prepareLayoutText({presetId:'minimal-clean',width:1080,height:1920,title:'商品实拍',subtitle:'整体与细节，都看得见。',sequence:1,total:3,captionStyle:style});
    layouts.push(text.text.filter(t=>t.kind==='SUBTITLE').map(t=>({width:t.width,height:t.height,top:t.top})));
    const png=await communityCaptionRaster(process.cwd(),source,'可见细节');labels.push(png);
    const actual=await sharp(png).metadata();expect(actual.width).toBe(1080);expect(actual.height).toBe(1920);expect(actual.hasAlpha).toBe(true);
  }
  expect(new Set(layouts.map(x=>JSON.stringify(x))).size).toBe(3);expect(labels[0]!.equals(labels[1]!)).toBe(false);expect(labels[1]!.equals(labels[2]!)).toBe(false);
  const source=applyCommunityDirection(structuredClone(variant()),options('caption.bold.1'));
  await expect(communityCaptionRaster(process.cwd(),source,'完整说明'.repeat(100))).rejects.toThrow();
});
