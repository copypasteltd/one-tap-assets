import {it,expect} from 'vitest';
import {freezeAiDisclosure,frozenAiDisclosure} from '../../src/worker/compiler/disclosure.js';
import {validateGenerationBudget} from '../../src/worker/generation/contracts.js';
import type {FrozenContract} from '../../src/worker/compiler/snapshot.js';
import {FONT_BINDING} from '../../src/worker/media/font.js';
import {variant} from '../helpers/fixtures.js';

function contract(id='portrait-social.ai-presenter-multi'){
  const source=structuredClone(variant(id));
  return {source,plan_hash:'a'.repeat(64),resource_versions:[{...FONT_BINDING}],creative:{target_frames:source.timeline_policy.target_frames}} as FrozenContract;
}
it('freezes all four official generated variants at their full planned output dimensions and timeline',()=>{
  for(const [id,frames] of [['quiet-luxury.ai-detail',450],['fresh-daily.ai-scene',360],['portrait-social.ai-presenter-single',450],['portrait-social.ai-presenter-multi',450]] as const){
    const c=contract(id);freezeAiDisclosure(c);
    expect(frozenAiDisclosure(c)).toMatchObject({text:'AI 生成',coverage:'ALL_IMAGES_ALL_VIDEO_FRAMES',plan_hash:c.plan_hash,font:FONT_BINDING});
    expect(c.creative.target_frames).toBe(frames);
  }
});
it('refuses author-disabled generated disclosure before compiling an order',()=>{
  const c=contract();c.source.ai_disclosure_required=false;
  expect(()=>freezeAiDisclosure(c)).toThrowError(expect.objectContaining({code:'AI_DISCLOSURE_REQUIRED'}));
});
it('refuses historical generated contracts without replacing their paid intents or acquiring another model',()=>{
  const c=contract();const before=JSON.stringify(c);
  expect(()=>validateGenerationBudget(c,true)).toThrowError(expect.objectContaining({code:'AI_DISCLOSURE_CONTRACT_REQUIRED'}));
  expect(JSON.stringify(c)).toBe(before);
});
it('binds exact platform text, font, placement and output policy instead of trusting author proof fields',()=>{
  for(const edit of [(c:FrozenContract)=>{c.ai_disclosure_contract!.geometry.margin++;},
    (c:FrozenContract)=>{c.ai_disclosure_contract!.font.hash='b'.repeat(64);},
    (c:FrozenContract)=>{c.source.output_slots[0]!.width=1440;},
    (c:FrozenContract)=>{c.plan_hash='b'.repeat(64);}
  ]){const c=contract();freezeAiDisclosure(c);edit(c);
    expect(()=>frozenAiDisclosure(c)).toThrowError(expect.objectContaining({code:'AI_DISCLOSURE_CONTRACT_REQUIRED'}));}
});
it('leaves original-photo contracts byte-identical and does not mislabel photographs as generated',()=>{
  const c=contract('minimal-clean.photo-layout'),before=JSON.stringify(c);freezeAiDisclosure(c);
  expect(frozenAiDisclosure(c)).toBeNull();expect(JSON.stringify(c)).toBe(before);
});
