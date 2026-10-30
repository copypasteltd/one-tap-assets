import type {VariantSource} from '../../api/modules/catalog.js';
import {plusRenderBinding,derivePlusSource,type PlusRenderBinding} from './plus-render.js';
import {plusVideoBinding,derivePlusVideoSource,PLUS_VIDEO_VERSION,type PlusVideoBinding} from './plus-video.js';
export type PlusWorkBinding=PlusRenderBinding|PlusVideoBinding;
export function plusWorkBinding(source:VariantSource):PlusWorkBinding|null{return plusRenderBinding(source)??plusVideoBinding(source);}
export function derivePlusWorkSource(base:VariantSource,b:PlusWorkBinding):VariantSource{
  return b.version===PLUS_VIDEO_VERSION?derivePlusVideoSource(base,b):derivePlusSource(base,b);
}
