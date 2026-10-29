import type {DTO} from '../contracts/types';
import {ClientError} from './api';
import type {ClientSession} from './session';

export interface DraftDestination {page:'photos'|'analysis'|'confirm';params:Record<string,string>}
const changed=()=>new ClientError('INPUT_VERSION_CHANGED','商品照片或档案已更新，请重新查询当前草稿');

/** Explicit resume uses server-owned input, never expired local photo paths. */
export async function resumeDraft(client:ClientSession,productId:string):Promise<DraftDestination>{
  await client.login();const buyer=client.api.userId;
  const scope=()=>{if(!buyer||client.api.userId!==buyer)throw new ClientError('ACCOUNT_CHANGED','账户已变化，请查询当前账户的草稿');};
  const product=await client.api.call('getProduct',{params:{product_id:productId}});scope();
  if(product.product_id!==productId)throw changed();
  const previous=client.recover(),same=previous.productId===product.product_id;
  client.remember({productId:product.product_id,...(!same?{analysisId:undefined,planId:undefined,previewId:undefined,quoteId:undefined,orderId:undefined,batchId:undefined,photoSetHash:undefined}:{})});
  const current=()=>{scope();if(client.recover().productId!==product.product_id)throw changed();};
  if(!product.photo_version)return {page:'photos',params:{}};
  if(product.profile_id){
    if(same&&previous.planId){
      try{
        const plan=await client.api.call('getPlan',{params:{plan_id:previous.planId}});current();
        if(plan.product_id===product.product_id&&plan.profile_id===product.profile_id
          &&(!previous.variantId||plan.variant_id===previous.variantId)&&['PLANNING','VALIDATING','READY'].includes(plan.state))
          return {page:'confirm',params:{plan_id:plan.plan_id}};
      }catch(error){if(!(error instanceof ClientError)||![404,410].includes(error.status))throw error;}
      current();client.remember({planId:undefined,previewId:undefined,quoteId:undefined});
    }
    return {page:'analysis',params:{}};
  }
  // This is the same logical intent used by analyzePhotos, including a lost ACK.
  const analysis=await client.api.call('createAnalysis',{params:{product_id:product.product_id},body:{photo_version:product.photo_version},
    key:client.intent('analysis',{product:product.product_id,version:product.photo_version})});current();
  if(analysis.product_id!==product.product_id||analysis.photo_version!==product.photo_version)throw changed();
  client.remember({analysisId:analysis.analysis_id,planId:undefined,previewId:undefined,quoteId:undefined});
  return {page:'analysis',params:{}};
}

export async function readDraftAnalysis(client:ClientSession):Promise<{product:DTO<'Product'>;analysis:DTO<'Analysis'>|null;profile:DTO<'Profile'>|null}>{
  await client.login();const current=client.recover();
  if(!current.productId)throw new ClientError('DRAFT_MISSING','请选择照片后开始整理');
  const product=await client.api.call('getProduct',{params:{product_id:current.productId}});
  if(product.product_id!==current.productId)throw changed();
  let analysis:DTO<'Analysis'>|null=null,profile:DTO<'Profile'>|null=null;
  if(!product.profile_id&&current.analysisId){
    analysis=await client.api.call('getAnalysis',{params:{analysis_id:current.analysisId}});
    if(analysis.product_id!==product.product_id||analysis.photo_version!==product.photo_version)throw changed();
  }
  if(product.profile_id||analysis?.state==='READY'){
    profile=await client.api.call('getProductProfile',{params:{product_id:product.product_id}});
    if(profile.product_id!==product.product_id||profile.photo_version!==product.photo_version
      ||(product.profile_id?profile.profile_id!==product.profile_id:profile.profile_id!==analysis?.profile_id))throw changed();
  }
  return {product,analysis,profile};
}
