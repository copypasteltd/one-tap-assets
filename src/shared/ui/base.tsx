import React, { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import Taro, { useDidShow, useDidHide } from '@tarojs/taro';
import { View, Text, Button } from '@tarojs/components';
import type { DTO } from '../contracts/types';
import { ClientError } from '../client/api';

export type PageName = 'home' | 'catalog' | 'library' | 'photos' | 'analysis' | 'preset' | 'confirm' | 'order' | 'pack' | 'settings' | 'help' | 'favorites' | 'creator' | 'draft' | 'rights' | 'publication' | 'moderation';
export const roots: PageName[] = ['home', 'catalog', 'library'];
export function navigate(page: PageName, params: Record<string, string> = {}): void {
  const query = Object.entries(params).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
  const url = `/pages/${page}/index${query ? `?${query}` : ''}`;
  void (roots.includes(page) ? Taro.reLaunch({ url }) : Taro.navigateTo({ url }));
}
export function message(error: unknown): string { return error instanceof ClientError ? error.message : '暂时无法完成，请保留当前记录后重试'; }
export function Action({ children, onClick, disabled = false, secondary = false }: { children: ReactNode; onClick(): void; disabled?: boolean; secondary?: boolean }) {
  return <Button className={`action ${secondary ? 'action-secondary' : ''}`} disabled={disabled} onClick={onClick}>{children}</Button>;
}
export function Notice({ children, error = false }: { children: ReactNode; error?: boolean }) { return <View className={`notice ${error ? 'notice-error' : ''}`}><Text>{children}</Text></View>; }
export function Panel({ children, className = '' }: { children: ReactNode; className?: string }) { return <View className={`panel ${className}`}>{children}</View>; }
export function useAction() {
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const lock = useRef(false); const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const run = async (work: () => Promise<void>): Promise<void> => {
    if (lock.current) return; lock.current = true; setBusy(true); setError('');
    try { await work(); } catch (e) { if (mounted.current) setError(message(e)); }
    finally { lock.current = false; if (mounted.current) setBusy(false); }
  }; return { busy, error, run };
}
export function useResource<T>(loader: () => Promise<T>, poll?: (data: T) => boolean) {
  const [data, setData] = useState<T>(); const [error, setError] = useState(''); const [busy, setBusy] = useState(true);
  const load = useRef(loader); load.current = loader; const shouldPoll = useRef(poll); shouldPoll.current = poll;
  const visible = useRef(true); const generation = useRef(0); const timer = useRef<ReturnType<typeof setTimeout>>(); const reloadRef = useRef<() => void>(() => {}); const attempts = useRef(0);
  const stop = useCallback(() => { visible.current = false; generation.current++; if (timer.current) clearTimeout(timer.current); }, []);
  const reload = useCallback(() => {
    if (!visible.current) return; if (timer.current) clearTimeout(timer.current); const current = ++generation.current; setBusy(true);
    void load.current().then(value => { if (!visible.current || generation.current !== current) return; setData(value); setError(''); setBusy(false);
      if (shouldPoll.current?.(value)) { const delay = Math.min(10000, 2000 + attempts.current++ * 1000) + Math.floor(Math.random() * 300); timer.current = setTimeout(() => reloadRef.current(), delay); }
    }).catch(e => { if (!visible.current || generation.current !== current) return; setBusy(false); setError(message(e));
      if (e instanceof ClientError && e.status === 429) timer.current = setTimeout(() => reloadRef.current(), Math.max(2000, e.retryAfterMs));
    });
  }, []); reloadRef.current = reload;
  useDidShow(() => { visible.current = true; attempts.current = 0; reload(); }); useDidHide(stop); useEffect(() => stop, [stop]);
  return { data, error, busy, reload };
}
export function ResourceState({ error, busy, retry }: { error: string; busy: boolean; retry(): void }) {
  return error ? <><Notice error>{error}</Notice><Action secondary onClick={retry}>重新查询</Action></> : busy ? <Text className='secondary'>正在获取最新记录…</Text> : null;
}
export function usePagedResource<T>(loader: (cursor?: string) => Promise<{ items: T[]; next_cursor: string | null }>, key: (value: T) => string) {
  const load = useRef(loader); load.current = loader; const identity = useRef(key); identity.current = key;
  const [items, setItems] = useState<T[]>([]); const [next, setNext] = useState<string | null>(null);
  const [busy, setBusy] = useState(true); const [error, setError] = useState(''); const [loaded, setLoaded] = useState(false);
  const visible = useRef(true); const generation = useRef(0); const nextRef = useRef<string | null>(null); const inFlight = useRef(false);
  const fetch = useCallback((reset: boolean) => {
    if (!visible.current || (!reset && (inFlight.current || !nextRef.current))) return;
    if (reset) { generation.current++; nextRef.current = null; setNext(null); setItems([]); setLoaded(false); }
    const current = generation.current; inFlight.current = true; setBusy(true); setError('');
    void load.current(reset ? undefined : nextRef.current!).then(page => {
      if (!visible.current || current !== generation.current) return;
      setItems(previous => {
        const values = new Map<string, T>(); for (const value of reset ? [] : previous) values.set(identity.current(value), value);
        for (const value of page.items) values.set(identity.current(value), value); return [...values.values()];
      }); nextRef.current = page.next_cursor; setNext(page.next_cursor); setLoaded(true);
    }).catch(reason => { if (visible.current && current === generation.current) setError(message(reason)); })
      .finally(() => { if (visible.current && current === generation.current) { inFlight.current = false; setBusy(false); } });
  }, []);
  const reload = useCallback(() => fetch(true), [fetch]);
  const stop = useCallback(() => { visible.current = false; generation.current++; inFlight.current = false; }, []);
  useDidShow(() => { visible.current = true; reload(); }); useDidHide(stop); useEffect(() => stop, [stop]);
  return { items, next, busy, error, loaded, reload, more: () => fetch(false) };
}
export function More({ next, busy, more }: { next: string | null; busy: boolean; more(): void }) {
  return next ? <Action secondary disabled={busy} onClick={more}>{busy ? '正在加载…' : '加载更多'}</Action> : null;
}
export function Slots({ slots }: { slots: DTO<'OutputSlot'>[] }) { return <View className='slots'>{slots.map(slot => <View className='slot' key={slot.slot_id}>
  <Text className='slot-kind'>{slot.kind === 'image' ? '图片' : slot.kind === 'video' ? '短片' : '文案'} × {slot.count}</Text>
  <Text className='secondary'>{slot.width && slot.height ? `${slot.width} × ${slot.height}` : '可直接复制'}{slot.duration_frames && slot.fps ? ` · ${slot.duration_frames / slot.fps}秒 · ${slot.fps}fps` : ''}</Text>
</View>)}</View>; }
export function PresetCard({ preset }: { preset: DTO<'PresetSummary'> }) {
  return <View className='preset-card' onClick={() => navigate('preset', { preset_id: preset.preset_id, version: preset.version })}>
    <View className={`preset-print tone-${preset.preset_id.length % 3}`}><View className='print-frame' /><Text>方案规格</Text></View>
    <View className='preset-copy'><Text className='card-title'>{preset.name}</Text><Text className='secondary'>{preset.style_tags.join(' · ')}</Text>
      <Text className='author'>{preset.source === 'OFFICIAL' ? '官方' : '社区'} · {preset.author_name}</Text><Text className='link'>{preset.sale_enabled ? '查看方案与素材清单 →' : '查看规格 · 准备中 →'}</Text></View>
  </View>;
}
