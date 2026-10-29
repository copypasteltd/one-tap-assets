import type {DTO} from '../contracts/types';
import {ClientError} from './api';
import type {ClientSession,RecoveryIds} from './session';
import {resumeDraft,type DraftDestination} from './drafts';

export interface PresetSelection {presetId:string;presetVersion:string;variantId:string;variantVersion:string}
export function selectedPreset(ids:RecoveryIds):PresetSelection|null{
  return ids.presetId&&ids.presetVersion&&ids.variantId&&ids.variantVersion
    ?{presetId:ids.presetId,presetVersion:ids.presetVersion,variantId:ids.variantId,variantVersion:ids.variantVersion}:null;
}
function checkSale(variant:DTO<'Variant'>):void{
  if(!variant.sale_enabled||variant.admission_state!=='ADMITTED'||variant.price_fen===null)
    throw new ClientError('VARIANT_NOT_FOR_SALE','这套方案的所选规格暂未开放，请查看其他方案',422);
}
export async function loadSelectedPreset(client:ClientSession):Promise<{detail:DTO<'PresetDetail'>;variant:DTO<'Variant'>}|null>{
  const selection=selectedPreset(client.recover());if(!selection)return null;
  const buyer=client.api.userId;
  const detail=await client.api.call('getPresetVersion',{params:{preset_id:selection.presetId,version:selection.presetVersion}});
  if(!buyer||client.api.userId!==buyer)throw new ClientError('ACCOUNT_CHANGED','账户已变化，请重新选择当前账户的方案');
  const variant=detail.variants.find(v=>v.variant_id===selection.variantId&&v.version===selection.variantVersion);
  if(detail.preset.preset_id!==selection.presetId||detail.preset.version!==selection.presetVersion||!variant)
    throw new ClientError('PRESET_SELECTION_CHANGED','原方案规格已不可用，请重新选择方案',409);
  return {detail,variant};
}
export async function startSelectedPlan(client:ClientSession):Promise<DTO<'Plan'>>{
  await client.login();const buyer=client.api.userId,current=client.recover(),selected=await loadSelectedPreset(client);
  if(!selected||!current.productId)throw new ClientError('DRAFT_MISSING','请先拍照并选择制作方案');
  const originalSelection=JSON.stringify(selectedPreset(current));
  const scope=()=>{if(!buyer||client.api.userId!==buyer)throw new ClientError('ACCOUNT_CHANGED','账户已变化，请查询当前账户的素材清单');
    if(client.recover().productId!==current.productId||JSON.stringify(selectedPreset(client.recover()))!==originalSelection)
      throw new ClientError('INPUT_VERSION_CHANGED','商品或所选方案已变化，请重新查询');};scope();
  checkSale(selected.variant);
  const profile=await client.api.call('getProductProfile',{params:{product_id:current.productId}});
  scope();
  if(profile.product_id!==current.productId)throw new ClientError('INPUT_VERSION_CHANGED','商品草稿已更新，请重新查询');
  const {detail,variant}=selected;
  const request={product_id:profile.product_id,photo_version:profile.photo_version,profile_id:profile.profile_id,identity_lock_id:profile.identity_lock_id,
    preset_id:detail.preset.preset_id,preset_version:detail.preset.version,variant_id:variant.variant_id,variant_version:variant.version};
  const check=await client.api.call('checkVariantInput',{body:{product_id:profile.product_id,profile_id:profile.profile_id,variant_id:variant.variant_id,variant_version:variant.version},key:client.intent('input-check',request)});
  scope();
  if(!check.eligible)throw new ClientError('MORE_PHOTOS_REQUIRED',check.capture_guidance.join('；')||'请补充商品照片',422);
  const plan=await client.api.call('createPlan',{body:request,key:client.intent('plan',request)});
  scope();
  if(plan.product_id!==request.product_id||plan.profile_id!==request.profile_id||plan.variant_id!==request.variant_id)
    throw new ClientError('INPUT_VERSION_CHANGED','返回的素材清单与当前商品不一致，请重新查询');
  client.remember({planId:plan.plan_id,previewId:undefined,quoteId:undefined,orderId:undefined});return plan;
}
/** Store all four version references before leaving for capture; never choose a replacement variant. */
export async function usePreset(client:ClientSession,detail:DTO<'PresetDetail'>,variantId:string):Promise<DraftDestination>{
  await client.login();const variant=detail.variants.find(v=>v.variant_id===variantId);
  if(!variant)throw new ClientError('PRESET_SELECTION_CHANGED','请重新选择制作规格');checkSale(variant);
  const selection:PresetSelection={presetId:detail.preset.preset_id,presetVersion:detail.preset.version,variantId:variant.variant_id,variantVersion:variant.version};
  const current=client.recover(),old=selectedPreset(current);
  client.remember({...selection,...(JSON.stringify(old)!==JSON.stringify(selection)?{planId:undefined,previewId:undefined,quoteId:undefined,orderId:undefined}:{})});
  if(!current.productId)return {page:'photos',params:{}};
  let product:DTO<'Product'>;
  try{product=await client.api.call('getProduct',{params:{product_id:current.productId}});}
  catch(error){if(!(error instanceof ClientError)||![404,410].includes(error.status))throw error;
    client.remember({productId:undefined,analysisId:undefined,planId:undefined,previewId:undefined,quoteId:undefined,orderId:undefined,batchId:undefined,photoSetHash:undefined});
    return {page:'photos',params:{}};}
  if(!product.profile_id)return resumeDraft(client,product.product_id);
  const plan=await startSelectedPlan(client);return {page:'confirm',params:{plan_id:plan.plan_id}};
}
