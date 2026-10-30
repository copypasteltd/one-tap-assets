import React, { useEffect } from 'react';
import { Text } from '@tarojs/components';
import type { DTO } from '../contracts/types';
import { readRecommendations } from '../client/recommendations';
import { client } from './runtime';
import { More, Notice, ResourceState, usePagedResource } from './base';
import { RecommendationCard } from './recommendation-card';

export function ProductRecommendations({ profile }: { profile: DTO<'Profile'> }) {
  const list = usePagedResource(cursor => readRecommendations(client(), profile, cursor), item => `${item.preset.preset_id}:${item.preset.version}`);
  // Recognition finishes after the native page's initial onShow; the child must load on its own mount.
  useEffect(() => { list.reload(); }, [list.reload]);
  return <><Text className='section-title'>适合这件商品的方案</Text><Text className='secondary'>先看照片是否够用，再按商品特点推荐。也可以自由挑选其他风格。</Text>
    <ResourceState error={list.error} busy={list.busy} retry={list.reload}/>
    {list.items.map(item => <RecommendationCard key={`${item.preset.preset_id}:${item.preset.version}`} item={item} productId={profile.product_id}/>)}
    {!list.busy && !list.error && list.loaded && !list.items.length && <Notice>{profile.conflicts.length
      ? '照片中的商品信息有冲突，请补拍同一件商品的整体和细节。' : !profile.photo_roles.some(r => r.role === 'WHOLE')
        ? '还需要一张清晰完整的商品照片，请补拍后再试。' : '当前没有已开放且适合这些照片的方案。可以先浏览风格，或补拍清晰细节后重新识别。'}</Notice>}
    <More next={list.next} busy={list.busy} more={list.more}/>
  </>;
}
