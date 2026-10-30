import React, { useEffect } from 'react';
import { Text } from '@tarojs/components';
import type { DTO } from '../contracts/types';
import { readRecommendations } from '../client/recommendations';
import { client } from './runtime';
import { Action, More, Notice, Panel, ResourceState, navigate, usePagedResource } from './base';

export function ProductRecommendations({ profile }: { profile: DTO<'Profile'> }) {
  const list = usePagedResource(cursor => readRecommendations(client(), profile, cursor), item => `${item.preset.preset_id}:${item.preset.version}`);
  // Recognition finishes after the native page's initial onShow; the child must load on its own mount.
  useEffect(() => { list.reload(); }, [list.reload]);
  return <><Text className='section-title'>适合这件商品的方案</Text><Text className='secondary'>先看照片是否够用，再按商品特点推荐。也可以自由挑选其他风格。</Text>
    <ResourceState error={list.error} busy={list.busy} retry={list.reload}/>
    {list.items.map(item => <Panel key={`${item.preset.preset_id}:${item.preset.version}`}>
      <Text className='card-title'>{item.preset.name}</Text><Text>{item.reason}</Text>
      <Text className='secondary'>{item.preset.source === 'OFFICIAL' ? '官方' : '社区'} · {item.preset.author_name} · {item.variant_ids.length} 种适配规格</Text>
      <Text className='caption'>{item.preset.style_tags.join(' · ')}</Text>
      <Action secondary onClick={() => navigate('preset', { preset_id: item.preset.preset_id, version: item.preset.version, variant_id: item.variant_ids[0]! })}>查看方案与适配规格</Action>
    </Panel>)}
    {!list.busy && !list.error && list.loaded && !list.items.length && <Notice>{profile.conflicts.length
      ? '照片中的商品信息有冲突，请补拍同一件商品的整体和细节。' : !profile.photo_roles.some(r => r.role === 'WHOLE')
        ? '还需要一张清晰完整的商品照片，请补拍后再试。' : '当前没有已开放且适合这些照片的方案。可以先浏览风格，或补拍清晰细节后重新识别。'}</Notice>}
    <More next={list.next} busy={list.busy} more={list.more}/>
  </>;
}
