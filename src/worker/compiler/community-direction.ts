import type {DTO} from '../../shared/contracts/types.js';
import {CREATIVE_COMPONENTS,type CaptionStyle} from '../../shared/domain/creative-components.js';
import type {VariantSource} from '../../api/modules/catalog.js';
import {hash} from '../../api/lib/crypto.js';
import {requireThat} from '../../api/lib/errors.js';

const VERSION='YPCC-COMMUNITY-DIRECTION-1';
export interface CommunityDirection{
  version:typeof VERSION;component_ids:string[];
  narrative:'WHOLE_FIRST'|'DETAIL_FIRST'|'VIEWS'|null;
  rhythm:'EVEN'|'QUICK_OPEN'|'LONG_END'|null;
  camera:'HOLD'|'PUSH'|'PAN'|null;caption:CaptionStyle|null;
}
export function selectedCommunityDirection(options:DTO<'ComponentOption'>[]):CommunityDirection|null{
  const result:CommunityDirection={version:VERSION,component_ids:[],narrative:null,rhythm:null,camera:null,caption:null};
  for(const option of options){
    if(option.type==='STYLE')continue;
    if(option.type==='ENGINE'){
      requireThat(option.supported_engines.length===1&&option.component_version_id===`engine.${option.supported_engines[0]}.1`,
        'COMMUNITY_COMPONENT_UNSUPPORTED','执行路线组件没有受控映射',422);continue;
    }
    const definition=CREATIVE_COMPONENTS.find(d=>d.option.component_version_id===option.component_version_id);
    requireThat(definition&&hash(definition.option)===hash(option),'COMMUNITY_COMPONENT_UNSUPPORTED','所选组件没有可信的执行映射或登记已改变',422);
    const key=option.type.toLowerCase() as 'narrative'|'rhythm'|'camera'|'caption';
    requireThat(result[key]===null,'COMMUNITY_COMPONENT_CONFLICT','同一类表现只能选择一项，或保留原方案设置',422);
    Object.assign(result,{[key]:definition.value});result.component_ids.push(option.component_version_id);
  }
  result.component_ids.sort();return result.component_ids.length?result:null;
}
export function communityDirection(source:VariantSource):CommunityDirection|null{
  const raw=source.creative_components.community_direction as CommunityDirection|undefined;
  if(raw===undefined)return null;
  requireThat(raw&&Array.isArray(raw.component_ids)&&raw.component_ids.length>0&&raw.component_ids.length<=4,
    'COMMUNITY_DIRECTION_CHANGED','冻结的创作组件不完整',503);
  const definitions=raw.component_ids.map(id=>CREATIVE_COMPONENTS.find(d=>d.option.component_version_id===id));
  requireThat(definitions.every(Boolean),'COMMUNITY_DIRECTION_CHANGED','冻结的创作组件没有可信映射',503);
  const expected=selectedCommunityDirection(definitions.map(d=>d!.option));
  requireThat(hash(raw)===hash(expected),'COMMUNITY_DIRECTION_CHANGED','冻结的创作组件与受控映射不一致',503);return raw;
}
export function communityCaptionStyle(source:VariantSource):CaptionStyle|undefined{return communityDirection(source)?.caption??undefined;}
export function applyCommunityDirection(source:VariantSource,options:DTO<'ComponentOption'>[]):VariantSource{
  const direction=selectedCommunityDirection(options);if(!direction)return source;
  source.creative_components.community_direction=direction;
  if(direction.caption)source.creative_components.caption_preset=direction.caption;
  const original=source.timeline_policy.base_segments??['商品整体','可见细节','整体收束'].map((role,i)=>({role,start_seconds:source.timeline_policy.target_frames*i/90,end_seconds:source.timeline_policy.target_frames*(i+1)/90}));
  const count=original.length,total=source.timeline_policy.target_frames;
  requireThat(Number.isSafeInteger(total)&&count>0&&count<=16&&total>=count*3,'COMMUNITY_TIMELINE_UNAVAILABLE','当前规格没有足够的整数帧供创作组件使用',422);
  const labels=original.map((segment,i)=>{
    if(!direction.narrative)return segment.role;
    if(count===1)return direction.narrative==='DETAIL_FIRST'?'可见细节':'商品整体';
    if(i===count-1)return '整体收束';
    if(direction.narrative==='DETAIL_FIRST')return i===0?'可见细节':i===1?'商品整体':'角度观察';
    if(direction.narrative==='VIEWS')return i===0?'整体观察':i%2?'角度对照':'细节观察';
    return i===0?'商品整体':i%2?'可见细节':'角度观察';
  });
  const weights=original.map((_,i)=>direction.rhythm==='QUICK_OPEN'?(i===0?0.6:i===count-1?1.4:1):direction.rhythm==='LONG_END'?(i===count-1?1.6:0.8):1);
  const sum=weights.reduce((a,b)=>a+b,0);let start=0,accumulated=0;
  source.timeline_policy.base_segments=original.map((s,i)=>{
    accumulated+=weights[i]!;const end=direction.rhythm?(i===count-1?total:Math.min(total-(count-i-1)*3,Math.max(start+3,Math.round(total*accumulated/sum)))):i===count-1?total:Math.round(s.end_seconds*30);
    requireThat(end>start,'COMMUNITY_TIMELINE_UNAVAILABLE','原制作规格的时间轴不完整',422);
    const result={role:labels[i]!,start_seconds:start/30,end_seconds:end/30};start=end;return result;
  });
  return source;
}
