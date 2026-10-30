import React, { useCallback, useEffect, useRef } from 'react';
import { useDidShow, useDidHide } from '@tarojs/taro';
import { Text, View } from '@tarojs/components';
import type { DTO } from '../contracts/types';
import { reportRecommendationEvent } from '../client/recommendation-events';
import { visibleDwell } from '../domain/recommendation-events';
import { client } from './runtime';
import { Action, Panel, navigate } from './base';
let nextCard = 0;

export function RecommendationCard({ item, productId }: { item: DTO<'Recommendation'>; productId: string }) {
  const node = useRef(`recommendation-card-${++nextCard}`), buyer = useRef(client().api.userId);
  const stop = useRef<() => void>(() => {});
  const hide = useCallback(() => { stop.current(); stop.current = () => {}; }, []);
  const start = useCallback(() => {
    hide(); if (!item.measurement) return;
    const dwell = visibleDwell(() => { void reportRecommendationEvent(client(), buyer.current, productId, item, 'IMPRESSION'); });
    const disconnect = client().host.observeVisibility?.(node.current, ratio => dwell.ratio(ratio));
    stop.current = () => { dwell.stop(); disconnect?.(); };
  }, [item, productId, hide]);
  useEffect(() => { start(); return hide; }, [start, hide]);
  useDidShow(start); useDidHide(hide);
  return <View id={node.current}><Panel>
    <Text className='card-title'>{item.preset.name}</Text><Text>{item.reason}</Text>
    <Text className='secondary'>{item.preset.source === 'OFFICIAL' ? '官方' : '社区'} · {item.preset.author_name} · {item.variant_ids.length} 种适配规格</Text>
    <Text className='caption'>{item.preset.style_tags.join(' · ')}</Text>
    <Action secondary onClick={() => {
      void reportRecommendationEvent(client(), buyer.current, productId, item, 'CLICK');
      navigate('preset', { preset_id: item.preset.preset_id, version: item.preset.version, variant_id: item.variant_ids[0]! });
    }}>查看方案与适配规格</Action>
  </Panel></View>;
}
