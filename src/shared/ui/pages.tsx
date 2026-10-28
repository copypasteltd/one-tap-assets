import React, { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import Taro, { useDidShow, useDidHide, useRouter } from '@tarojs/taro';
import { View, Text, Button, Image, Video, Switch, Textarea } from '@tarojs/components';
import type { DTO } from '../contracts/types';
import type { LocalPhoto } from '../platform/ports';
import { ClientError } from '../client/api';
import { analyzePhotos } from '../client/photos';
import { AlbumQueue, type AlbumItem } from '../client/album';
import { client } from './runtime';
import './theme.css';
import { Action, Notice, Panel, useAction, useResource, usePagedResource, ResourceState, Slots, PresetCard, More, navigate, roots, type PageName } from './base';
import { Favorites, Creator, DraftEditor, Rights, Publication, Moderation, PresetCommunityActions } from './community';
import { OptionalPreview } from './preview';
import {LimitedRevision} from './revision';
export { navigate } from './base';

const title = { home: '一品成片', catalog: '方案社区', library: '我的素材', photos: '拍下你的商品', analysis: '整理商品信息', preset: '方案详情', confirm: '确认素材清单', order: '我的订单', pack: '领取素材', settings: '账户与隐私', help: '帮助与反馈', favorites: '我的收藏', creator: '我的方案', draft: '编辑方案', rights: '授权资料', publication: '发布记录', moderation: '举报与申诉' };
const paymentText: Record<string, string> = { CREATED: '等待付款', PENDING: '正在确认付款', UNKNOWN: '付款结果待确认', CONFIRMED: '已确认付款', FAILED: '付款未完成', CANCELLED: '付款已取消' };
const fulfillmentText: Record<string, string> = { NOT_STARTED: '尚未开始制作', QUEUED: '等待制作', IN_PROGRESS: '正在制作', FAILED: '制作未完成', CANCELLED: '制作已取消', DELIVERED: '素材已交付' };
const stageText: Record<string, string> = { ANALYZE: '整理商品信息', PLAN: '梳理素材内容', PRODUCTION: '制作画面', POST: '后期制作', QC: '检查文件规格', REVIEW_FACTS: '核验商品与内容', REVIEW_STYLE: '检查风格与体验', DELIVER: '整理完整素材包' };
function Home() {
  const resource = useResource(() => client().api.call('listPresets', { query: { source: 'OFFICIAL', limit: 3 } }));
  const [resume, setResume] = useState(false); useDidShow(() => setResume(Boolean(client().recover().productId)));
  return <><View className='hero'><Text className='eyebrow'>让商品的好，被看见</Text><Text className='hero-title'>拍下商品，{<Text className='marked'>成套出片</Text>}</Text>
    <Text className='hero-subtitle'>拍3–5张，自动识别商品与特点</Text>
    <View className='photo-guides'>{['整体', '角度', '细节'].map((label, i) => <View className={`photo-print print-${i}`} key={label}><Image src={`/assets/example-${i}.png`} mode='aspectFill' className='guide-photo' /><Text className='photo-label'>{label}</Text></View>)}</View><Text className='caption'>示例商品照片 · 你的照片仅用于本次制作</Text>
    <Action onClick={() => navigate('photos')}>拍照做素材　↗</Action>{resume && <Action secondary onClick={() => navigate(client().recover().analysisId ? 'analysis' : 'photos')}>继续上次草稿</Action>}</View>
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
function Photos() {
  const [photos, setPhotos] = useState<LocalPhoto[]>([]); const [batch, setBatch] = useState(''); const action = useAction();
  return <><Text className='page-headline'>把商品拍清楚，<Text className='marked'>剩下的交给我们。</Text></Text><Notice>整体、侧面和细节各拍一张。保持同一件商品，颜色和包装尽量清晰。</Notice>
    <View className='selected-photos'>{photos.map(photo => <Image key={photo.sha256} src={photo.path} mode='aspectFit' className='selected-photo' />)}</View>
    <Action disabled={action.busy} secondary={photos.length > 0} onClick={() => void action.run(async () => { const chosen = await client().host.choosePhotos(); setPhotos(chosen); setBatch(`batch-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`); })}>{photos.length ? '重新选择照片' : '拍照或从相册选择'}</Action>
    {photos.length > 0 && <Action disabled={action.busy} onClick={() => void action.run(async () => { await analyzePhotos(client(), photos, batch); navigate('analysis'); })}>{action.busy ? '正在上传并整理…' : `用这${photos.length}张照片开始`}</Action>}
    {action.error && <Notice error>{action.error}</Notice>}<Text className='caption'>支持JPG / PNG，单张不超过10MB。无需填写商品表单。</Text>
  </>;
}
function Analysis() {
  const resource = useResource(async () => { await client().login(); const recovery = client().recover();
    if (!recovery.analysisId || !recovery.productId) throw new ClientError('DRAFT_MISSING', '请选择照片后开始整理');
    const analysis = await client().api.call('getAnalysis', { params: { analysis_id: recovery.analysisId } });
    const profile = analysis.state === 'READY' ? await client().api.call('getProductProfile', { params: { product_id: recovery.productId } }) : null; return { analysis, profile };
  }, value => ['QUEUED', 'ANALYZING', 'VALIDATING'].includes(value.analysis.state));
  return <><Text className='page-headline'>{resource.data?.profile ? '已经认识你的商品' : '正在看看你的商品'}</Text><ResourceState {...resource} retry={resource.reload} />
    {resource.data?.profile ? <><Panel><Text className='card-title'>{resource.data.profile.name ?? '你的商品'}</Text><Text>{resource.data.profile.summary}</Text><Text className='secondary'>暂不能确认：{resource.data.profile.unknowns.join('、') || '未发现需要补充的属性'}</Text></Panel><Action onClick={() => navigate('catalog')}>挑选一套方案</Action></>
      : resource.data && ['FAILED', 'BLOCKED'].includes(resource.data.analysis.state) ? <><Notice error>这些照片暂时无法支持完整制作，请补拍整体和清晰细节。</Notice><Action onClick={() => navigate('photos')}>重新拍照</Action></> : <Notice>正在整理可见特点和照片用途。你可以离开页面，稍后从草稿继续。</Notice>}
  </>;
}
function Preset() {
  const route = useRouter(); const action = useAction(); const [selected, setSelected] = useState<string>('');
  const resource = useResource(() => client().api.call('getPresetVersion', { params: { preset_id: route.params.preset_id ?? '', version: route.params.version ?? '' } }));
  const detail = resource.data; const variant = detail?.variants.find(v => v.variant_id === selected) ?? detail?.variants[0];
  return <><ResourceState {...resource} retry={resource.reload} />{detail && variant && <><Text className='page-headline'>{detail.preset.name}</Text><Text className='author'>{detail.preset.source === 'OFFICIAL' ? '官方' : '社区'} · {detail.preset.author_name}</Text><Text>{detail.description}</Text>
    <View className='filters'>{detail.variants.map(v => <Button className={`filter ${v.variant_id === variant.variant_id ? 'active' : ''}`} key={v.variant_id} onClick={() => setSelected(v.variant_id)}>{v.name}</Button>)}</View>
    <Panel><Text className='card-title'>这一套，将为你制作</Text><Slots slots={variant.output_slots} /><Text className='secondary'>{variant.speech_mode === 'NATIVE_ZH' ? '中文原声讲解，按实际音轨对齐字幕' : '无讲解配音'} · 成品领取期7天</Text></Panel>
    <Notice>{variant.input_guidance.join('；')}</Notice><Text className='caption'>{detail.license_summary}</Text><PresetCommunityActions detail={detail} />
    {!variant.sale_enabled || variant.admission_state !== 'ADMITTED' || variant.price_fen === null ? <Notice>这套方案还在准备中，开放后可拍照制作。</Notice> : <Action disabled={action.busy} onClick={() => void action.run(async () => {
      await client().login(); const recovery = client().recover(); client().remember({ presetId: detail.preset.preset_id, presetVersion: detail.preset.version });
      if (!recovery.productId) { navigate('photos'); return; }
      const profile = await client().api.call('getProductProfile', { params: { product_id: recovery.productId } });
      const request = { product_id: profile.product_id, photo_version: profile.photo_version, profile_id: profile.profile_id, identity_lock_id: profile.identity_lock_id, preset_id: detail.preset.preset_id, preset_version: detail.preset.version, variant_id: variant.variant_id, variant_version: variant.version };
      const check = await client().api.call('checkVariantInput', { body: { product_id: profile.product_id, profile_id: profile.profile_id, variant_id: variant.variant_id, variant_version: variant.version }, key: client().intent('input-check', request) });
      if (!check.eligible) throw new ClientError('MORE_PHOTOS_REQUIRED', check.capture_guidance.join('；') || '请补充商品照片');
      const plan = await client().api.call('createPlan', { body: request, key: client().intent('plan', request) }); client().remember({ planId: plan.plan_id }); navigate('confirm', { plan_id: plan.plan_id });
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
    {resource.items.map(order => <Panel key={order.order_id}><Text className='card-title'>{fulfillmentText[order.fulfillment_state]}</Text><Text className='secondary'>{paymentText[order.payment_state]} · ¥{(order.amount_fen / 100).toFixed(2)}</Text><Text className='caption'>{new Date(order.created_at).toLocaleString()}</Text><Action secondary onClick={() => navigate(order.fulfillment_state === 'DELIVERED' ? 'pack' : 'order', { order_id: order.order_id })}>{order.fulfillment_state === 'DELIVERED' ? '查看素材包' : '查看原订单'}</Action></Panel>)}<More {...resource} />
  </>;
}
function Order() {
  const route = useRouter(); const action = useAction(); const [returned, setReturned] = useState('');
  const resource = useResource(async () => { await client().login(); const order = await client().api.call('getOrder', { params: { order_id: route.params.order_id ?? client().recover().orderId ?? '' } });
    const stages = order.job_id ? await client().api.call('listJobStages', { params: { job_id: order.job_id } }) : null;
    const refund = order.refund_id ? await client().api.call('getRefund', { params: { refund_id: order.refund_id } }) : null; return { order, stages, refund };
  }, d => ['CREATED', 'PENDING', 'UNKNOWN'].includes(d.order.payment_state) || ['QUEUED', 'IN_PROGRESS'].includes(d.order.fulfillment_state) || Boolean(d.refund && ['REQUESTED', 'PROCESSING', 'UNKNOWN'].includes(d.refund.state)));
  const order = resource.data?.order;
  return <><ResourceState {...resource} retry={resource.reload} />{order && <><Text className='page-headline'>{order.fulfillment_state === 'NOT_STARTED' ? paymentText[order.payment_state] : fulfillmentText[order.fulfillment_state]}</Text><Text className='price'>¥{(order.amount_fen / 100).toFixed(2)}</Text><Text className='caption'>订单 {order.order_id}</Text>
    {order.payment_state !== 'CONFIRMED' && <Notice>付款结果以服务端核验为准。返回或网络中断后，继续查询这笔原订单。</Notice>}
    {returned && <Notice>{returned}</Notice>}
    {order.fulfillment_state === 'NOT_STARTED' && ['CREATED', 'PENDING'].includes(order.payment_state) && Date.parse(order.payable_until) > Date.now() && <Action disabled={action.busy} onClick={() => void action.run(async () => {
      const payment = await client().api.call('getOrCreatePaymentAction', { params: { order_id: order.order_id }, key: client().intent('payment-status', { order: order.order_id, nonce: Date.now() }) });
      if (payment.action.kind === 'QUERY_ORIGINAL_ORDER') setReturned('正在准备或核验这笔原订单，请稍后查询。');
      else { const result = await client().host.pay(payment); setReturned(result === 'CANCELLED' ? '已返回原订单，可继续查看付款结果。' : '已返回，正在等待服务端确认付款结果。'); } resource.reload();
    })}>{action.busy ? '正在查询原单…' : '继续原单付款'}</Action>}
    {resource.data?.stages && <Panel>{resource.data.stages.items.map(stage => <View className={`stage ${stage.state === 'SUCCEEDED' ? 'stage-complete' : ''}`} key={stage.stage_id}><Text>{stage.state === 'SUCCEEDED' ? '✓' : stage.state === 'RUNNING' ? '◉' : '○'}　{stageText[stage.name] ?? '整理素材'}</Text><Text className='secondary'>{stage.state === 'FAILED' ? '未完成' : stage.state === 'SUCCEEDED' ? '完成' : stage.state === 'RUNNING' ? '进行中' : '等待'}</Text></View>)}</Panel>}
    {resource.data?.refund && <Notice>{resource.data.refund.state === 'REFUNDED' ? '原路退款已确认' : '退款正在按原单处理，具体结果请持续查询。'}</Notice>}
    {order.fulfillment_state === 'DELIVERED' && <Action onClick={() => navigate('pack', { order_id: order.order_id })}>查看完整素材包</Action>}
    {action.error && <Notice error>{action.error}</Notice>}<Action secondary onClick={resource.reload}>查询原单最新状态</Action><Action secondary onClick={() => navigate('help', { order_id: order.order_id })}>订单问题反馈</Action>
  </>}</>;
}
function Pack() {
  const route = useRouter(); const action = useAction(); const [links, setLinks] = useState<Record<string, string>>({}); const [items, setItems] = useState<AlbumItem[]>([]); const queue = useRef<AlbumQueue>();
  const resource = useResource(async () => { await client().login(); return client().api.call('getDeliverables', { params: { order_id: route.params.order_id ?? '' } }); });
  useEffect(()=>{queue.current?.stop();queue.current=undefined;setItems([]);setLinks({});},[resource.data?.manifest_id]);
  useDidHide(() => queue.current?.stop()); useEffect(() => () => queue.current?.stop(), []);
  const openQueue = async (): Promise<AlbumQueue> => { if (!queue.current) { queue.current = new AlbumQueue(client(), resource.data!, setItems); await queue.current.open(); } return queue.current; };
  return <><ResourceState {...resource} retry={resource.reload} />{resource.data && <><View className='pack-heading'><Text className='page-headline'>你的整套素材，做好了。</Text><Text>领取至 {new Date(resource.data.expires_at).toLocaleString()}</Text></View>
    {resource.data.items.map(item => <Panel key={item.deliverable_id}><View className='section-title'><Text>{item.kind === 'image' ? '商品图片' : item.kind === 'video' ? '商品短片' : '商品文案'}{resource.data?.cover_deliverable_id===item.deliverable_id?' · 素材包封面':''}</Text><Text className='caption'>{item.width ? `${item.width} × ${item.height}` : ''}</Text></View>
      {item.kind === 'copy' ? <><Text selectable>{item.text}</Text><Action secondary onClick={() => void action.run(async () => { await client().host.copy(item.text ?? ''); await Taro.showToast({ title: '文案已复制', icon: 'none' }); })}>复制文案</Action></>
        : <>{links[item.deliverable_id] ? item.kind === 'image' ? <Image src={links[item.deliverable_id]!} mode='widthFix' className='pack-image' /> : <Video src={links[item.deliverable_id]!} controls objectFit='contain' className='pack-video' /> : <View className='media-placeholder'><Text>{item.kind === 'image' ? '点击查看这张图片' : '点击查看完整竖屏短片'}</Text></View>}
          <Action secondary onClick={() => void action.run(async () => { const link = await client().api.call('createDownloadLink', { params: { deliverable_id: item.deliverable_id }, key: client().intent('view-link', { id: item.deliverable_id, nonce: Date.now() }) }); setLinks(old => ({ ...old, [item.deliverable_id]: link.url })); })}>{links[item.deliverable_id] ? '重新获取查看链接' : '查看素材'}</Action></>}
    </Panel>)}
    <LimitedRevision key={resource.data.manifest_id} pack={resource.data} onDelivered={resource.reload}/>
    <Action disabled={action.busy} onClick={() => void action.run(async () => { await (await openQueue()).run(); })}>{action.busy ? '正在逐项保存…' : '保存素材到相册'}</Action>
    {items.map(item => <View className='save-row' key={item.id}><Text>{item.kind === 'image' ? '图片' : '短片'} · {({ PENDING: '等待', DOWNLOADING: '下载中', SAVING: '正在写入相册', SAVED: '已保存', FAILED: '保存未完成', UNKNOWN: '需要核对相册' })[item.state]}</Text>{item.state === 'UNKNOWN' && <Button className='filter' disabled={action.busy} onClick={() => void action.run(async () => { const answer = await Taro.showModal({ title: '先查看手机相册', content: '如果这份素材已经保存，请取消。仅在确认相册中没有它时重试，以免重复。', confirmText: '确认未保存' }); if (answer.confirm) await (await openQueue()).run([item.id]); })}>已核对，重试</Button>}</View>)}
    {action.error && <Notice error>{action.error}</Notice>}<Text className='caption'>已明确成功的文件会跳过。下载完成不代表已写入相册。</Text><Action secondary onClick={() => navigate('help', { order_id: resource.data!.order_id })}>素材问题反馈</Action>
  </>}</>;
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
