import React, { useRef, useState, type ReactNode } from 'react';
import Taro, { useRouter } from '@tarojs/taro';
import { View, Text, Button, Image, Switch, Textarea } from '@tarojs/components';
import type { DTO } from '../contracts/types';
import { client } from './runtime';
import './theme.css';
import { Action, Notice, Panel, useAction, useResource, usePagedResource, ResourceState, Slots, PresetCard, More, navigate, roots, type PageName } from './base';
import { Favorites, Creator, DraftEditor, Rights, Publication, Moderation, PresetCommunityActions } from './community';
import { OptionalPreview } from './preview';
import {Pack} from './pack';
import {Photos} from './photos';
import {Analysis} from './analysis';
import {ResumeDraft,ProductDrafts} from './drafts';
import {selectedPreset,usePreset} from '../client/preset-selection';
import {Order,paymentText,fulfillmentText} from './order';
export { navigate } from './base';

const title = { home: '一品成片', catalog: '方案社区', library: '我的素材', photos: '拍下你的商品', analysis: '整理商品信息', preset: '方案详情', confirm: '确认素材清单', order: '我的订单', pack: '领取素材', settings: '账户与隐私', help: '帮助与反馈', favorites: '我的收藏', creator: '我的方案', draft: '编辑方案', rights: '授权资料', publication: '发布记录', moderation: '举报与申诉' };
function Home() {
  const resource = useResource(() => client().api.call('listPresets', { query: { source: 'OFFICIAL', limit: 3 } }));
  return <><View className='hero'><Text className='eyebrow'>让商品的好，被看见</Text><Text className='hero-title'>拍下商品，{<Text className='marked'>成套出片</Text>}</Text>
    <Text className='hero-subtitle'>拍3–5张，自动识别商品与特点</Text>
    <View className='photo-guides'>{['整体', '角度', '细节'].map((label, i) => <View className={`photo-print print-${i}`} key={label}><Image src={`/assets/example-${i}.png`} mode='aspectFill' className='guide-photo' /><Text className='photo-label'>{label}</Text></View>)}</View><Text className='caption'>示例商品照片 · 你的照片仅用于本次制作</Text>
    <Action onClick={() => navigate('photos')}>拍照做素材　↗</Action><ResumeDraft/></View>
    <View className='section-title'><Text>试试这些方案</Text><Text className='link' onClick={() => navigate('catalog')}>更多方案 →</Text></View>
    <ResourceState {...resource} retry={resource.reload} />{resource.data?.items.map(preset => <PresetCard preset={preset} key={preset.preset_id} />)}
  </>;
}
function Catalog() {
  const [source, setSource] = useState(''); const sourceRef = useRef(source); sourceRef.current = source;
  const resource = usePagedResource(cursor => client().api.call('listPresets', { query: { limit: 20, cursor, ...(sourceRef.current ? { source: sourceRef.current } : {}) } }), p => p.preset_id);
  return <><Text className='page-headline'>挑一种风格，<Text className='marked'>整套都好看。</Text></Text><Text className='secondary'>先看看方案，拍照后为你匹配</Text>
    <View className='filters'>{([['', '全部'], ['OFFICIAL', '官方'], ['COMMUNITY', '社区']] as const).map(([value, label]) => <Button className={`filter ${source === value ? 'active' : ''}`} key={value} onClick={() => { sourceRef.current = value; setSource(value); resource.reload(); }}>{label}</Button>)}</View>
    <View className='community-actions'><Button className='filter' onClick={() => navigate('favorites')}>我的收藏</Button><Button className='filter' onClick={() => navigate('creator')}>我的方案</Button></View>
    <ResourceState {...resource} retry={resource.reload} />{resource.loaded && !resource.items.length && <Notice>还没有这一类方案，先看看官方方案。</Notice>}
    {resource.items.map(preset => <PresetCard preset={preset} key={preset.preset_id} />)}<More {...resource} />
  </>;
}
function Preset() {
  const route = useRouter(); const action = useAction(); const [selected, setSelected] = useState<string>(()=>{const previous=selectedPreset(client().recover());return route.params.variant_id??(previous&&previous.presetId===route.params.preset_id&&previous.presetVersion===route.params.version?previous.variantId:'');});
  const resource = useResource(() => client().api.call('getPresetVersion', { params: { preset_id: route.params.preset_id ?? '', version: route.params.version ?? '' } }));
  const detail = resource.data; const variant = detail?.variants.find(v => v.variant_id === selected) ?? detail?.variants[0];
  return <><ResourceState {...resource} retry={resource.reload} />{detail && variant && <><Text className='page-headline'>{detail.preset.name}</Text><Text className='author'>{detail.preset.source === 'OFFICIAL' ? '官方' : '社区'} · {detail.preset.author_name}</Text><Text>{detail.description}</Text>
    <View className='filters'>{detail.variants.map(v => <Button className={`filter ${v.variant_id === variant.variant_id ? 'active' : ''}`} key={v.variant_id} onClick={() => setSelected(v.variant_id)}>{v.name}</Button>)}</View>
    <Panel><Text className='card-title'>这一套，将为你制作</Text><Slots slots={variant.output_slots} /><Text className='secondary'>{variant.speech_mode === 'NATIVE_ZH' ? '中文原声讲解，按实际音轨对齐字幕' : '无讲解配音'} · 成品领取期7天</Text></Panel>
    <Notice>{variant.input_guidance.join('；')}</Notice><Text className='caption'>{detail.license_summary}</Text><PresetCommunityActions detail={detail} />
    {!variant.sale_enabled || variant.admission_state !== 'ADMITTED' || variant.price_fen === null ? <Notice>这套方案还在准备中，开放后可拍照制作。</Notice> : <Action disabled={action.busy} onClick={() => void action.run(async () => {
      const next=await usePreset(client(),detail,variant.variant_id);navigate(next.page,next.params);
    })}>{action.busy ? '正在整理素材清单…' : '用这个方案'}</Action>}{action.error && <Notice error>{action.error}</Notice>}
  </>}</>;
}
function Confirm() {
  const route = useRouter(); const [quote, setQuote] = useState<DTO<'Quote'>>(); const [accepted, setAccepted] = useState(false); const action = useAction();
  const resource = useResource(async () => { await client().login(); return client().api.call('getPlan', { params: { plan_id: route.params.plan_id ?? client().recover().planId ?? '' } }); }, p => ['PLANNING', 'VALIDATING'].includes(p.state)); const plan = resource.data;
  return <><ResourceState {...resource} retry={resource.reload} />{plan && <><Text className='page-headline'>确认这一套素材</Text><Text>{plan.summary || '正在整理内容与清单…'}</Text><Slots slots={plan.output_slots} />
    {plan.state==='READY' && plan.plan_hash && plan.engine==='PHOTO_LAYOUT' && <OptionalPreview key={`${plan.plan_id}:${plan.plan_hash}`} plan={plan} />}
    {plan.state === 'READY' && plan.plan_hash && !quote && <Action disabled={action.busy} onClick={() => void action.run(async () => { setQuote(await client().api.call('createQuote', { body: { plan_id: plan.plan_id, plan_hash: plan.plan_hash! }, key: client().intent('quote', { plan: plan.plan_id, nonce: Date.now() }) })); })}>查看完整费用</Action>}
    {['FAILED', 'BLOCKED'].includes(plan.state) && <Notice error>当前照片或方案暂不能完成制作，请返回调整方案或重新拍照。</Notice>}
    {quote && <Panel><Text className='price'>¥{(quote.amount_fen / 100).toFixed(2)}</Text><Text>整包费用 · 最长{Math.ceil(quote.hard_deadline_seconds / 60)}分钟完成制作</Text><Text className='secondary'>报价有效至{new Date(quote.expires_at).toLocaleTimeString()}。交付后可领取7天，48小时内可成功小改一次。平台制作失败按原单处理退款。</Text>
      <View className='consent'><Switch checked={accepted} onChange={e => setAccepted(e.detail.value)} color='#FF7948' /><Text>我已确认完整清单、费用和交付规则</Text></View>
      <Action disabled={!accepted || action.busy} onClick={() => void action.run(async () => { const order = await client().api.call('createOrder', { body: { quote_id: quote.quote_id, channel: client().host.platform }, key: client().intent('order', { quote: quote.quote_id }) }); client().remember({ orderId: order.order_id }); navigate('order', { order_id: order.order_id }); })}>{action.busy ? '正在建立原订单…' : '确认并继续'}</Action>
    </Panel>}{action.error && <Notice error>{action.error}</Notice>}</>}</>;
}
function Library() {
  const resource = usePagedResource(async cursor => { await client().login(); return client().api.call('listOrders', { query: { limit: 20, cursor } }); }, o => o.order_id);
  return <><View className='section-title'><Text>我的素材与订单</Text><Text className='link' onClick={() => navigate('settings')}>账户设置</Text></View><ResourceState {...resource} retry={resource.reload} />
    <View className='community-actions'><Button className='filter' onClick={() => navigate('favorites')}>我的收藏</Button><Button className='filter' onClick={() => navigate('creator')}>我的方案</Button><Button className='filter' onClick={() => navigate('moderation')}>举报与申诉</Button></View>
    {resource.loaded && !resource.items.length && <><Notice>还没有素材包。拍下商品，开始你的第一套。</Notice><Action onClick={() => navigate('photos')}>拍照做素材</Action></>}
    {resource.items.map(order => <Panel key={order.order_id}><Text className='card-title'>{fulfillmentText[order.fulfillment_state]}</Text><Text className='secondary'>{paymentText[order.payment_state]} · ¥{(order.amount_fen / 100).toFixed(2)}</Text><Text className='caption'>{new Date(order.created_at).toLocaleString()}</Text><Action secondary onClick={() => navigate(order.fulfillment_state === 'DELIVERED' ? 'pack' : 'order', { order_id: order.order_id })}>{order.fulfillment_state === 'DELIVERED' ? '查看素材包' : '查看原订单'}</Action></Panel>)}<More {...resource} /><ProductDrafts/>
  </>;
}
function Settings() {
  const action = useAction(); const [deletion, setDeletion] = useState<DTO<'PrivacyDeletion'>>();
  return <><Text className='page-headline'>账户与隐私</Text><Notice>照片用于当前商品识别与制作，成品在领取期内保留。财务和争议记录按必要范围留存。</Notice>
    <Action disabled={action.busy} secondary onClick={() => void action.run(async () => { await client().login(); const answer = await Taro.showModal({ title: '删除本账户的媒体资料？', content: '进行中的制作将受影响，领取链接会撤销。已保存到手机的文件不会被远程删除。', confirmText: '确认申请', confirmColor: '#B83232' });
      if (answer.confirm) setDeletion(await client().api.call('requestPrivacyDeletion', { body: { scope: 'ACCOUNT_MEDIA', acknowledge_inflight_contract: true }, key: client().intent('privacy-deletion', { nonce: Date.now() }) })); })}>申请删除媒体资料</Action>
    {deletion && <Notice>删除申请已受理，正在处理。清理结果确认后才算完成。</Notice>}{action.error && <Notice error>{action.error}</Notice>}<Action secondary onClick={() => { client().logout(); navigate('home'); }}>退出当前会话</Action><Action secondary onClick={() => navigate('help')}>查看帮助</Action>
  </>;
}
function Help() {
  const route = useRouter(); const [text, setText] = useState(''); const [sent, setSent] = useState(''); const action = useAction(); const resource = useResource(() => client().api.call('listHelpArticles'));
  return <><Text className='page-headline'>我们一起解决</Text><ResourceState {...resource} retry={resource.reload} />{resource.data?.items.map(article => <Panel key={article.article_id}><Text className='card-title'>{article.title}</Text><Text>{article.body}</Text></Panel>)}
    {route.params.order_id && <Panel><Text className='card-title'>反馈这笔订单的问题</Text><Textarea className='feedback-input' maxlength={2000} value={text} onInput={e => setText(e.detail.value)} placeholder='描述遇到的问题，请勿填写密码或支付凭证' /><Action disabled={action.busy || !text.trim()} onClick={() => void action.run(async () => { await client().login(); const ticket = await client().api.call('createSupportTicket', { params: { order_id: route.params.order_id! }, body: { category: 'OTHER', message: text.trim() }, key: client().intent('ticket', { order: route.params.order_id, text: text.trim() }) }); setSent(ticket.ticket_id); })}>提交问题</Action>{sent && <Notice>已受理，反馈编号：{sent}</Notice>}</Panel>}{action.error && <Notice error>{action.error}</Notice>}
  </>;
}
const screens: Record<PageName, () => ReactNode> = { home: Home, catalog: Catalog, library: Library, photos: Photos, analysis: Analysis, preset: Preset, confirm: Confirm, order: Order, pack: Pack, settings: Settings, help: Help, favorites: Favorites, creator: Creator, draft: DraftEditor, rights: Rights, publication: Publication, moderation: Moderation };
export function MiniPage({ name }: { name: PageName }) {
  const Screen = screens[name]; return <View className={`app-page page-${name} ${roots.includes(name) ? 'has-tabs' : ''}`}><View className='app-header'><Text className='brand' onClick={() => navigate('home')}>{name === 'home' ? '一品成片' : title[name]}</Text>{!roots.includes(name) && <Button className='back-button' onClick={() => { if (Taro.getCurrentPages().length > 1) void Taro.navigateBack(); else navigate('catalog'); }}>返回</Button>}</View>
    <View className='page-content'><Screen /></View>{roots.includes(name) && <View className='bottom-tabs'>{([['home', '拍照制作', '◉'], ['catalog', '方案社区', '▧'], ['library', '我的素材', '▱']] as const).map(([page, label, icon]) => <Button key={page} className={`tab ${page === name ? 'active' : ''}`} onClick={() => { if (page !== name) navigate(page); }}><Text className='tab-icon'>{icon}</Text><Text>{label}</Text></Button>)}</View>}
  </View>;
}
