import type {VariantSource} from '../../api/modules/catalog.js';
import type {CreativePlan} from '../compiler/plan.js';
import type {AiDisclosureContract} from '../compiler/disclosure.js';
import {prepareLayoutText} from './layout.js';
import {loadProductionFont,type ProductionFont} from './font.js';

/** The same actual glyph/geometry preparation used by the renderer, without
 * customer photos or provider purchases. Call before publishing a quote. */
export async function validatePlanLayout(plan:CreativePlan,source:VariantSource,preset:string,font?:ProductionFont,disclosure?:AiDisclosureContract):Promise<void>{
  const pinned=font??await loadProductionFont(process.cwd());
  const configured=source.creative_components.platform_style_id;
  const presetId=typeof configured==='string'?configured:preset;
  const images=source.output_slots.filter(s=>s.kind==='image');
  for(const [index,slot] of images.entries()){
    const image=plan.image_slots.find(s=>s.slot_id===slot.slot_id)!;
    await prepareLayoutText({presetId,width:slot.width,height:slot.height,title:image.title,subtitle:plan.copy,
      sequence:index+1,total:images.length,font:pinned,aiLabel:source.engine!=='PHOTO_LAYOUT',...(disclosure?{disclosure}:{})});
  }
  if(source.engine==='PHOTO_LAYOUT')for(const [index,shot] of plan.shots.entries()){
    await prepareLayoutText({presetId,width:1080,height:1920,title:plan.title,subtitle:shot.intent,sequence:index+1,total:plan.shots.length,font:pinned});
  }
}
