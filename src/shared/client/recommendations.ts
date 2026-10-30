import type { ClientSession } from './session.js';
import type { DTO } from '../contracts/types.js';
import { ClientError } from './api.js';

export async function readRecommendations(client: ClientSession, expected: Pick<DTO<'Profile'>, 'product_id' | 'profile_id' | 'photo_version'>, cursor?: string): Promise<DTO<'RecommendationList'>> {
  await client.login(); const buyer = client.api.userId;
  const current = () => {
    if (!buyer || client.api.userId !== buyer) throw new ClientError('ACCOUNT_CHANGED', '账户已变化，请重新查询当前商品');
    if (client.recover().productId !== expected.product_id) throw new ClientError('INPUT_VERSION_CHANGED', '当前商品已变化，请重新打开识别结果');
  };
  current();
  const product = await client.api.call('getProduct', { params: { product_id: expected.product_id } }); current();
  if (product.product_id !== expected.product_id || product.profile_id !== expected.profile_id || product.photo_version !== expected.photo_version)
    throw new ClientError('INPUT_VERSION_CHANGED', '商品照片或档案已更新，请重新打开识别结果');
  const page = await client.api.call('recommendPresets', { params: { product_id: expected.product_id }, query: { limit: 4, cursor } }); current();
  // A delayed response may belong to the previous profile even when the product identifier stayed the same.
  const latest = await client.api.call('getProduct', { params: { product_id: expected.product_id } }); current();
  if (latest.product_id !== expected.product_id || latest.profile_id !== expected.profile_id || latest.photo_version !== expected.photo_version)
    throw new ClientError('INPUT_VERSION_CHANGED', '商品照片或档案已更新，请刷新推荐');
  return page;
}
