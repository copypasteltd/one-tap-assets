import type {DTO} from '../contracts/types';
import {ClientError} from './api';
import type {ClientSession} from './session';

export const correctionFields={name:'商品名称',category:'商品类别',observation:'可见特征',label_text:'标签文字',photo_role:'照片用途'} as const;
export const photoRoleLabels={WHOLE:'整体',SIDE:'侧面',DETAIL:'细节',LABEL:'标签',OTHER:'其他'} as const;
export interface CorrectionDraft {field:DTO<'CorrectionRequest'>['field'];value:string;evidence_asset_ids:string[]}
export interface CorrectionContext {product:DTO<'Product'>;profile:DTO<'Profile'>}
export interface PreparedCorrection {readonly account:string;readonly product:DTO<'Product'>;readonly profile:Pick<DTO<'Profile'>,'profile_id'|'identity_lock_id'|'revision'>;readonly body:DTO<'CorrectionRequest'>;readonly key:string}
const changed=()=>new ClientError('INPUT_VERSION_CHANGED','商品档案或当前草稿已变化，请重新读取后再纠错',409);
export function correctionLimit(field:CorrectionDraft['field']):number{return field==='name'?200:field==='category'?120:1000;}
/** Only an explicit optional action prepares this immutable in-memory intent.
 * Neither the text nor photo evidence is written to recovery/storage. */
export function prepareCorrection(client:ClientSession,context:CorrectionContext,draft:CorrectionDraft):PreparedCorrection {
  const {product,profile}=context,account=client.api.userId;
  if(!account||client.recover().productId!==product.product_id)throw changed();
  if(profile.product_id!==product.product_id||profile.profile_id!==product.profile_id||profile.photo_version!==product.photo_version)throw changed();
  if(!Object.prototype.hasOwnProperty.call(correctionFields,draft.field))throw new ClientError('CORRECTION_VALUE_INVALID','请选择需要纠正的内容');
  const value=draft.value.trim(),ids=[...draft.evidence_asset_ids];
  if(!value||Array.from(value).length>correctionLimit(draft.field))throw new ClientError('CORRECTION_VALUE_INVALID',`请填写1至${correctionLimit(draft.field)}字`);
  if(ids.length>5||new Set(ids).size!==ids.length||ids.some(id=>!profile.photo_roles.some(p=>p.asset_id===id)))
    throw new ClientError('EVIDENCE_SCOPE_INVALID','请选择当前商品的原照片，不要重复选择');
  if(!['name','category'].includes(draft.field)&&!ids.length)throw new ClientError('EVIDENCE_REQUIRED','请选择能看到这项内容的原照片');
  if(draft.field==='photo_role'&&!Object.prototype.hasOwnProperty.call(photoRoleLabels,value))throw new ClientError('INVALID_PHOTO_ROLE','请选择照片用途');
  if(draft.field==='name'&&value===profile.name||draft.field==='category'&&value===profile.category)
    throw new ClientError('CORRECTION_UNCHANGED','这项内容没有变化');
  ids.sort((a,b)=>profile.photo_roles.findIndex(p=>p.asset_id===a)-profile.photo_roles.findIndex(p=>p.asset_id===b));
  const body:DTO<'CorrectionRequest'>={expected_revision:product.revision,profile_id:profile.profile_id,field:draft.field,value,...(ids.length?{evidence_asset_ids:ids}:{})};
  const key=client.intent('profile-correction',{product_id:product.product_id,body});
  return Object.freeze({account,product:Object.freeze({...product}),profile:Object.freeze({profile_id:profile.profile_id,identity_lock_id:profile.identity_lock_id,revision:profile.revision}),body:Object.freeze(body),key});
}
/** Lost acknowledgements replay the original key/body, then read the current
 * pointer. A concurrent correction cannot be overwritten or shown as this one. */
export async function submitCorrection(client:ClientSession,intent:PreparedCorrection,signal?:AbortSignal):Promise<CorrectionContext> {
  const current=()=>{if(signal?.aborted)throw new ClientError('CORRECTION_INTERRUPTED','页面已离开，请重新读取当前档案');
    if(client.api.userId!==intent.account)throw new ClientError('ACCOUNT_CHANGED','账户已变化，请重新读取当前账户的档案');
    if(client.recover().productId!==intent.product.product_id)throw changed();};current();
  const reply=await client.api.call('correctProfile',{params:{product_id:intent.product.product_id},body:intent.body,key:intent.key,...(signal?{signal}:{})});current();
  if(!reply||reply.product_id!==intent.product.product_id||reply.photo_version!==intent.product.photo_version||reply.profile_id===intent.profile.profile_id
    ||reply.identity_lock_id===intent.profile.identity_lock_id||reply.revision!==intent.profile.revision+1||!/^[a-f0-9]{64}$/.test(reply.profile_hash))throw changed();
  const product=await client.api.call('getProduct',{params:{product_id:intent.product.product_id},...(signal?{signal}:{})});current();
  if(product.profile_id!==reply.profile_id||product.product_id!==reply.product_id||product.photo_version!==reply.photo_version||product.revision!==intent.product.revision+1)throw changed();
  const profile=await client.api.call('getProductProfile',{params:{product_id:product.product_id},...(signal?{signal}:{})});current();
  if(profile.profile_id!==reply.profile_id||profile.profile_hash!==reply.profile_hash||profile.product_id!==product.product_id||profile.photo_version!==product.photo_version)throw changed();
  // The old plan/preview/quote refer to the old profile. Paid orders and their
  // immutable contracts remain in their original order history.
  client.remember({planId:undefined,previewId:undefined,quoteId:undefined});return {product,profile};
}
