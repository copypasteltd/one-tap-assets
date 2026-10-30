import {hash} from '../../api/lib/crypto.js';
import {requireThat} from '../../api/lib/errors.js';
import type {FrozenContract,ResourceBinding} from './snapshot.js';
import {FONT_BINDING} from '../media/font.js';
import {PLUS_RENDER_PIXELS} from '../../shared/domain/plus-render.js';
import {plusWorkBinding} from '../../shared/domain/plus-work.js';
import {PLUS_VIDEO_VERSION} from '../../shared/domain/plus-video.js';

export const AI_DISCLOSURE_VERSION='YPCC-VISIBLE-AI-1';
export interface AiDisclosureContract {
  version:typeof AI_DISCLOSURE_VERSION;text:'AI 生成';placement:'TOP_LEFT';coverage:'ALL_IMAGES_ALL_VIDEO_FRAMES';
  font:ResourceBinding;source_policy_hash:string;plan_hash:string;
  geometry:{reference_width:1080;margin:32;width:224;height:72;font_size:30};
  colors:{background:'#263B32';foreground:'#FFFAEE'};
  rendering_profile?:'PLUS_IMAGE_V1'|'PLUS_VIDEO_V1';
}
function expected(contract:FrozenContract):AiDisclosureContract {
  requireThat(contract.source.ai_disclosure_required===true,'AI_DISCLOSURE_REQUIRED','生成式方案必须声明可见AI标识，作者不能关闭',503);
  requireThat(contract.resource_versions.some(r=>hash(r)===hash(FONT_BINDING)),'AI_DISCLOSURE_FONT_REQUIRED','AI标识必须绑定原订单字体许可',503);
  const plus=plusWorkBinding(contract.source);
  requireThat(contract.creative.target_frames>0&&contract.creative.target_frames<=3600
    &&contract.source.output_slots.every(s=>plus?(plus.version===PLUS_VIDEO_VERSION||s.kind==='image')&&s.width>=256&&s.width<=3840&&s.height>=256&&s.height<=3840&&s.width*s.height<=PLUS_RENDER_PIXELS:
      s.width>=640&&s.width<=1920&&s.height>=640&&s.height<=1920),
    'AI_DISCLOSURE_CAPACITY_UNAVAILABLE','原素材规格超出完整可见标识检查容量',503);
  return {version:AI_DISCLOSURE_VERSION,text:'AI 生成',placement:'TOP_LEFT',coverage:'ALL_IMAGES_ALL_VIDEO_FRAMES',
    font:{...FONT_BINDING},plan_hash:contract.plan_hash,
    source_policy_hash:hash({engine:contract.source.engine,required:contract.source.ai_disclosure_required,outputs:contract.source.output_slots,...(plus?{plus_edit_hash:hash(plus)}:{})}),
    geometry:{reference_width:1080,margin:32,width:224,height:72,font_size:30},colors:{background:'#263B32',foreground:'#FFFAEE'},...(plus?{rendering_profile:plus.version===PLUS_VIDEO_VERSION?'PLUS_VIDEO_V1' as const:'PLUS_IMAGE_V1' as const}:{})};
}
/** Platform-only quote compilation. The existing immutable private contract
 * hash binds this policy; neither the model nor community data supplies it. */
export function freezeAiDisclosure(contract:FrozenContract):void {
  if(contract.source.engine==='PHOTO_LAYOUT'&&!plusWorkBinding(contract.source)?.inherits_ai){frozenAiDisclosure(contract);return;}
  const policy=expected(contract);
  requireThat(!contract.ai_disclosure_contract||hash(contract.ai_disclosure_contract)===hash(policy),
    'AI_DISCLOSURE_CONTRACT_CHANGED','不能替换已冻结的AI标识规则',503);
  contract.ai_disclosure_contract=policy;
}
export function frozenAiDisclosure(contract:FrozenContract):AiDisclosureContract|null {
  if(contract.source.engine==='PHOTO_LAYOUT'&&!plusWorkBinding(contract.source)?.inherits_ai){
    requireThat(!contract.ai_disclosure_contract&&contract.source.ai_disclosure_required!==true,
      'AI_DISCLOSURE_ROUTE_UNAVAILABLE','原图路线尚未声明生成式标识制作能力',503);return null;
  }
  requireThat(contract.ai_disclosure_contract&&hash(contract.ai_disclosure_contract)===hash(expected(contract)),
    'AI_DISCLOSURE_CONTRACT_REQUIRED','原订单缺少完整冻结的AI标识规则，不可补写历史订单',503);
  return contract.ai_disclosure_contract;
}
