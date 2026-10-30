import React, { useEffect, useRef, useState, type ReactNode } from 'react';
import Taro, { useRouter } from '@tarojs/taro';
import { View, Text, Button, Input, Textarea, Switch, Image, Video } from '@tarojs/components';
import type { DTO } from '../contracts/types';
import type { LocalPhoto } from '../platform/ports';
import { uploadEvidence } from '../client/evidence';
import { client } from './runtime';
import { Action, Notice, Panel, ResourceState, PresetCard, More, navigate, useAction, useResource, usePagedResource } from './base';
import { CreatorWorkflow } from './creator-workflow';
import {CREATIVE_GROUPS,selectCreativeComponent} from '../domain/creative-components';

const rightsText: Record<string, string> = { SUBMITTED: '待核验', VERIFIED: '已核验', REJECTED: '未通过', REVOKED: '已撤回' };
const rightsScope = { OWNED_PRODUCT: '商品使用权', SAMPLE_PUBLICATION: '样例公开授权', THIRD_PARTY_RESOURCE: '第三方资源许可' };
const publicationText: Record<string, string> = { DRAFT: '草稿', SUBMITTED: '已提交', UNDER_REVIEW: '审核中', CHANGES_REQUESTED: '需要补充修改', APPROVED: '审核通过', REJECTED: '未通过审核', PUBLISHED: '已发布', SUSPENDED: '已暂停', WITHDRAWN: '已撤回' };
const reportText: Record<string, string> = { OPEN: '已受理', REVIEWING: '正在核查', RESOLVED: '已形成处理决定', DISMISSED: '未采纳举报', APPEALED: '申诉处理中' };
const appealText: Record<string, string> = { OPEN: '已受理', REVIEWING: '正在核查', RESOLVED: '已处理', REJECTED: '未通过' };
function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return <View className='form-field'><Text className='field-label'>{label}</Text>{children}{hint && <Text className='caption'>{hint}</Text>}</View>;
}
function toggle(values: string[], value: string): string[] { return values.includes(value) ? values.filter(x => x !== value) : [...values, value]; }

export function Favorites() {
  const action = useAction(); const list = usePagedResource(async cursor => { await client().login(); return client().api.call('listFavorites', { query: { limit: 20, cursor } }); }, p => p.preset_id);
  return <><Text className='page-headline'>喜欢的风格，<Text className='marked'>留在这里。</Text></Text><ResourceState {...list} retry={list.reload} />
    {list.loaded && !list.items.length && <><Notice>还没有收藏。去方案社区，挑一套喜欢的风格。</Notice><Action onClick={() => navigate('catalog')}>看看方案</Action></>}
    {list.items.map(p => <View key={p.preset_id}><PresetCard preset={p} /><Button className='text-action' disabled={action.busy} onClick={() => void action.run(async () => {
      await client().api.call('deleteFavorite', { params: { preset_id: p.preset_id } }); list.reload();
    })}>取消收藏</Button></View>)}<More {...list} />{action.error && <Notice error>{action.error}</Notice>}
  </>;
}
export function PresetCommunityActions({ detail }: { detail: DTO<'PresetDetail'> }) {
  const action = useAction(); const [saved, setSaved] = useState(false);
  return <><View className='community-actions'><Button className='filter' disabled={action.busy} onClick={() => void action.run(async () => { await client().login();
    const result = await client().api.call('setFavorite', { params: { preset_id: detail.preset.preset_id } }); setSaved(result.favorited);
  })}>{saved ? '已收藏' : '收藏方案'}</Button>{detail.fork_allowed && <Button className='filter' disabled={action.busy} onClick={() => void action.run(async () => {
    await client().login(); const body = { parent_version: detail.preset.version, name: `${detail.preset.name.slice(0, 90)} · 我的创作` };
    const result = await client().api.call('forkPreset', { params: { preset_id: detail.preset.preset_id }, body, key: client().intent('fork', { preset: detail.preset.preset_id, body }) }); navigate('draft', { draft_id: result.draft_id });
  })}>以此创作方案</Button>}<Button className='filter' onClick={() => navigate('moderation', { preset_id: detail.preset.preset_id, version: detail.preset.version })}>举报此版本</Button></View>
    {action.error && <Notice error>{action.error}</Notice>}{detail.preset.sample_id && <SampleGallery sampleId={detail.preset.sample_id} publicSample />}</>;
}
export function SampleGallery({ sampleId, publicSample = false }: { sampleId: string; publicSample?: boolean }) {
  const action = useAction(); const [media, setMedia] = useState<DTO<'SampleMedia'>>();
  return <><Action secondary disabled={action.busy} onClick={() => void action.run(async () => { if (!publicSample) await client().login();
    setMedia(publicSample ? await client().api.call('getPublicSampleMedia', { params: { sample_id: sampleId } }) : await client().api.call('createPrivateSampleMediaLinks', {
      params: { sample_id: sampleId }, key: client().intent('sample-links', { sampleId, nonce: Date.now() }) }));
  })}>{action.busy ? '正在获取样例…' : media ? '刷新样例' : '查看样例'}</Action>
    {media && <><Notice>{media.label === 'AUTHORIZED_SAMPLE_NOT_YOUR_RESULT' ? '这是作者已获授权的公开样例。实际制作会使用你自己的商品照片。' : '这是你的私有样例，仅你可查看；公开需要另行审核授权。'}</Notice>{media.items.map((m, i) => m.kind === 'image'
      ? <Image key={i} src={m.url} mode='widthFix' className='pack-image' /> : <Video key={i} src={m.url} className='pack-video' controls objectFit='contain' />)}</>}
    {action.error && <Notice error>{action.error}</Notice>}</>;
}
export function Creator() {
  const drafts = usePagedResource(async cursor => { await client().login(); return client().api.call('listPresetDrafts', { query: { limit: 20, cursor } }); }, x => x.draft_id);
  const publications = usePagedResource(async cursor => { await client().login(); return client().api.call('listPresetPublications', { query: { limit: 20, cursor } }); }, x => x.publication_id);
  return <><Text className='page-headline'>把你的审美，<Text className='marked'>做成方案。</Text></Text><Text className='secondary'>选择风格、制作规格与已授权资源，保存自己的方案。</Text>
    <Action onClick={() => navigate('draft')}>创建方案</Action><View className='community-actions'><Button className='filter' onClick={() => navigate('rights')}>授权资料</Button><Button className='filter' onClick={() => navigate('moderation')}>举报与申诉</Button></View>
    <Text className='section-title'>我的草稿</Text><ResourceState {...drafts} retry={drafts.reload} />{drafts.loaded && !drafts.items.length && <Notice>还没有草稿。也可以在喜欢的方案中选择“以此创作方案”，保留作者来源后继续创作。</Notice>}
    {drafts.items.map(d => <Panel key={d.draft_id}><Text className='card-title'>{d.config.name}</Text><Text className='secondary'>{d.config.style_tags.join(' · ')}</Text><Text className='caption'>最近修改 {new Date(d.updated_at).toLocaleString()}</Text><Action secondary onClick={() => navigate('draft', { draft_id: d.draft_id })}>继续编辑</Action></Panel>)}<More {...drafts} />
    <Text className='section-title'>发布记录</Text><ResourceState {...publications} retry={publications.reload} />{publications.loaded && !publications.items.length && <Text className='secondary'>提交发布后，可在这里继续查看审核与可售状态。</Text>}
    {publications.items.map(p => <Panel key={p.publication_id}><Text className='card-title'>{publicationText[p.state] ?? '发布状态已更新'}</Text><Text className='secondary'>{p.sale_enabled ? '已开放制作' : '尚未开放制作'}</Text><Action secondary onClick={() => navigate('publication', { publication_id: p.publication_id })}>查看发布记录</Action></Panel>)}<More {...publications} />
  </>;
}

export function DraftEditor() {
  const route = useRouter(); const draftId = route.params.draft_id; const action = useAction(); const [form, setForm] = useState<DTO<'PresetConfig'> | null>(null);
  const [revision, setRevision] = useState<number | null>(null); const [tags, setTags] = useState(''); const [nonce] = useState(() => `${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const resource = useResource(async () => { await client().login(); const [components, blueprints, resources, draft] = await Promise.all([
    client().api.call('listCommunityComponents'), client().api.call('listVariantBlueprints'), client().api.call('listCommunityResources'),
    draftId ? client().api.call('getPresetDraft', { params: { draft_id: draftId } }) : Promise.resolve(null)]); return { components, blueprints, resources, draft }; });
  const data = resource.data;
  useEffect(() => {
    if (!data || form) return;
    setForm(data.draft?.config ?? { name: '', description: '', style_tags: [], parent_preset_version: null,
      component_versions: data.components.items.filter(c => c.type === 'STYLE').slice(0, 1).map(c => c.component_version_id),
      variant_blueprint_ids: data.blueprints.items.filter(b => b.engine === 'PHOTO_LAYOUT').slice(0, 1).map(b => b.blueprint_id), resource_version_ids: [], fork_allowed: true });
    setRevision(data.draft?.revision ?? null);
    setTags(data.draft?.config.style_tags.join('，') ?? '');
  }, [data, form]);
  const patch = (value: Partial<DTO<'PresetConfig'>>) => setForm(current => current && ({ ...current, ...value }));
  const conflict = Boolean(data?.draft && revision !== null && data.draft.revision !== revision);
  const unsaved = Boolean(data?.draft && form && JSON.stringify(data.draft.config) !== JSON.stringify(form));
  const ready = form && form.name.trim() && form.description.trim() && form.style_tags.length && form.component_versions.length && form.variant_blueprint_ids.length;
  return <><Text className='page-headline'>{draftId ? '让这套方案，更像你。' : '从一种风格开始。'}</Text><ResourceState {...resource} retry={resource.reload} />
    {conflict && <><Notice error>这份草稿已有更新，当前编辑内容已保留。请检查服务器版本，再决定是否替换。</Notice><Action secondary onClick={() => void action.run(async () => {
      const result = await Taro.showModal({ title: '采用服务器版本？', content: '当前尚未保存的修改将被替换。', confirmText: '替换修改' }); if (result.confirm && data?.draft) { setForm(data.draft.config); setTags(data.draft.config.style_tags.join('，')); setRevision(data.draft.revision); }
    })}>采用服务器版本</Action></>}
    {form && data && <><Panel><Field label='方案名称'><Input className='field-input' maxlength={100} value={form.name} onInput={e => patch({ name: e.detail.value })} placeholder='例如：午后小店的轻快日常' /></Field>
      <Field label='创作说明' hint='说明适合什么商品、希望呈现怎样的画面与节奏。'><Textarea className='feedback-input' maxlength={2000} value={form.description} onInput={e => patch({ description: e.detail.value })} placeholder='写下这套方案的创作想法' /></Field>
      <Field label='风格标签' hint='用逗号分隔，最多10个标签，每个不超过50字。'><Input className='field-input' maxlength={400} value={tags} onInput={e => { setTags(e.detail.value); patch({ style_tags: e.detail.value.split(/[,，、]/).map(x => x.trim()).filter(Boolean).slice(0, 10) }); }} placeholder='自然、轻快、日常' /></Field></Panel>
      <Text className='section-title'>一种主风格</Text><View className='choice-grid'>{data.components.items.filter(c => c.type === 'STYLE').map(c => <Button className={`choice-card ${form.component_versions.includes(c.component_version_id) ? 'selected' : ''}`} key={c.component_version_id} onClick={() => patch({ component_versions: [c.component_version_id, ...form.component_versions.filter(id => !data.components.items.some(x => x.type === 'STYLE' && x.component_version_id === id))] })}><Text className='card-title'>{c.name}</Text><Text className='secondary'>{c.description}</Text></Button>)}</View>
      <Text className='section-title'>提供哪些制作规格</Text><View className='choice-grid'>{data.blueprints.items.map(b => <Button className={`choice-card ${form.variant_blueprint_ids.includes(b.blueprint_id) ? 'selected' : ''}`} key={b.blueprint_id} onClick={() => patch({ variant_blueprint_ids: toggle(form.variant_blueprint_ids, b.blueprint_id).slice(0, 10) })}><Text className='card-title'>{b.name}</Text><Text className='secondary'>{b.engine === 'PHOTO_LAYOUT' ? '使用商品原照片制作' : b.engine === 'PER_SHOT_AI' ? '逐个镜头生成后剪辑' : '参考商品生成连续短片'}</Text></Button>)}</View>
      {CREATIVE_GROUPS.map(group=><View key={group.type}><Text className='section-title'>{group.name}（可选）</Text><Text className='secondary'>{group.hint}</Text><Text className='caption'>每类可选一项，再点已选项即可恢复制作规格的原设置。</Text><View className='choice-grid'>{data.components.items.filter(c=>c.type===group.type).map(c=>{
        const selected=form.component_versions.includes(c.component_version_id),compatible=form.variant_blueprint_ids.every(id=>{const b=data.blueprints.items.find(x=>x.blueprint_id===id);return b&&c.supported_engines.includes(b.engine)&&b.allowed_component_version_ids.includes(c.component_version_id);});
        return <Button key={c.component_version_id} disabled={!compatible&&!selected} className={`choice-card ${selected?'selected':''}`} onClick={()=>patch({component_versions:selectCreativeComponent(form.component_versions,c.component_version_id,data.components.items)})}><Text className='card-title'>{c.name}{selected?' · 已选':''}</Text><Text className='secondary'>{c.description}</Text></Button>;
      })}</View></View>)}
      <Text className='section-title'>路线限定（可选）</Text><View className='filters'>{data.components.items.filter(c=>c.type==='ENGINE').map(c=><Button key={c.component_version_id} className={`filter ${form.component_versions.includes(c.component_version_id)?'active':''}`} onClick={()=>patch({component_versions:selectCreativeComponent(form.component_versions,c.component_version_id,data.components.items)})}>{c.name}{form.component_versions.includes(c.component_version_id)?' · 已选':''}</Button>)}</View><Text className='caption'>限定后，全部制作规格都必须使用这条路线。</Text>
      <Text className='section-title'>可选资源</Text>{!data.resources.items.length && <Text className='secondary'>当前没有开放的附加资源，可直接保存方案。</Text>}
      <View className='filters'>{data.resources.items.map(r => <Button key={r.resource_version_id} className={`filter ${form.resource_version_ids.includes(r.resource_version_id) ? 'active' : ''}`} onClick={() => patch({ resource_version_ids: toggle(form.resource_version_ids, r.resource_version_id) })}>{r.name}</Button>)}</View>
      <View className='consent'><Switch checked={form.fork_allowed} color='#236449' onChange={e => patch({ fork_allowed: e.detail.value })} /><Text>允许他人在保留来源后派生方案</Text></View>{form.parent_preset_version && <Notice>这份方案保留了原作者与来源版本，修改不会移除派生关系。</Notice>}
      <Action disabled={action.busy || !ready || conflict} onClick={() => void action.run(async () => {
        const config = { ...form, name: form.name.trim(), description: form.description.trim() }; await client().login();
        if (draftId && revision !== null) { const body = { expected_revision: revision, config }; const updated = await client().api.call('updatePresetDraft', { params: { draft_id: draftId }, body, key: client().intent('draft-save', { draftId, body }) }); setForm(updated.config); setRevision(updated.revision); resource.reload(); }
        else { const result = await client().api.call('createPresetDraft', { body: { config }, key: client().intent('draft-create', { nonce, config }) }); await Taro.redirectTo({ url: `/pages/draft/index?draft_id=${encodeURIComponent(result.draft_id)}` }); }
      })}>{action.busy ? '正在保存…' : '保存方案'}</Action><Text className='caption'>保存草稿后仍需自有样例、授权审核和制作能力准入，才能发布并开放制作。</Text></>}
    {action.error && <><Notice error>{action.error}</Notice><Action secondary onClick={resource.reload}>检查最新草稿</Action></>}
    {draftId && data?.draft && <CreatorWorkflow draft={data.draft} blueprints={data.blueprints.items} disabled={conflict || unsaved || action.busy} renderSample={id => <SampleGallery sampleId={id} />} />}
  </>;
}

export function Rights() {
  const route = useRouter(); const [productId, setProductId] = useState(route.params.product_id ?? ''); const [resourceIds, setResourceIds] = useState<string[]>([]);
  const products = usePagedResource(async cursor => { await client().login(); return client().api.call('listProducts', { query: { limit: 20, cursor } }); }, p => p.product_id);
  const resources = useResource(async () => { await client().login(); return client().api.call('listCommunityResources'); });
  const action = useAction(); const [scope, setScope] = useState<keyof typeof rightsScope>('SAMPLE_PUBLICATION'); const [statement, setStatement] = useState(''); const [reference, setReference] = useState('');
  const [photos, setPhotos] = useState<LocalPhoto[]>([]); const [batch, setBatch] = useState(''); const [submitted, setSubmitted] = useState(false);
  const list = usePagedResource(async cursor => { await client().login(); return client().api.call('listRightsRecords', { query: { limit: 20, cursor } }); }, r => r.rights_record_id);
  return <><Text className='page-headline'>让每一份创作，<Text className='marked'>有据可依。</Text></Text><Text className='secondary'>授权资料仅供本人和获准审核人员查看，不会作为公开样例。</Text><Panel>
    <Field label='授权用途'><View className='filters'>{Object.entries(rightsScope).map(([key, label]) => <Button key={key} className={`filter ${scope === key ? 'active' : ''}`} onClick={() => { setScope(key as keyof typeof rightsScope); setSubmitted(false); }}>{label}</Button>)}</View></Field>
    {scope !== 'THIRD_PARTY_RESOURCE' ? <Field label='关联商品照片' hint='授权只对应所选商品的这组照片；更换照片后需补充新授权。'>
      <ResourceState {...products} retry={products.reload} />{products.items.filter(p => p.photo_version !== null).map(p => <Button key={p.product_id} className={`choice-button ${productId === p.product_id ? 'selected' : ''}`} onClick={() => { setProductId(p.product_id); setSubmitted(false); }}>{productId === p.product_id ? '已选 · ' : ''}商品照片 · {new Date(p.created_at).toLocaleString()}</Button>)}<More {...products} />
      {products.loaded && !products.items.some(p => p.photo_version !== null) && <Text className='secondary'>请先拍摄并上传商品照片。</Text>}
    </Field> : <Field label='对应第三方资源'><ResourceState {...resources} retry={resources.reload} />{resources.data?.items.map(r => <Button key={r.resource_version_id} className={`choice-button ${resourceIds.includes(r.resource_version_id) ? 'selected' : ''}`} onClick={() => { setResourceIds(toggle(resourceIds, r.resource_version_id)); setSubmitted(false); }}>{resourceIds.includes(r.resource_version_id) ? '已选 · ' : ''}{r.name}</Button>)}{resources.data?.items.length === 0 && <Text className='secondary'>暂无可关联资源。</Text>}</Field>}
    <Field label='授权说明'><Textarea className='feedback-input' maxlength={3000} value={statement} onInput={e => { setStatement(e.detail.value); setSubmitted(false); }} placeholder='说明你与商品或素材的关系，以及获准的使用范围' /></Field>
    <Field label='许可来源（可选）'><Input className='field-input' maxlength={1000} value={reference} onInput={e => { setReference(e.detail.value); setSubmitted(false); }} placeholder='例如合同名称、授权方与有效期' /></Field>
    <Action secondary disabled={action.busy} onClick={() => void action.run(async () => { await client().login(); const picked = await client().host.choosePhotos(); if (picked.length) { setPhotos(picked); setBatch(`${Date.now()}-${Math.random().toString(36).slice(2)}`); setSubmitted(false); } })}>{photos.length ? `重新选择证明图片（已选${photos.length}张）` : '选择证明图片'}</Action>
    <Text className='caption'>上传1至5张清晰证明图片，请遮住不需要审核的证件号码等信息。</Text>
    <Action disabled={action.busy || submitted || !statement.trim() || !photos.length || (scope === 'THIRD_PARTY_RESOURCE' ? !resourceIds.length : !productId)} onClick={() => void action.run(async () => {
      const ids = await uploadEvidence(client(), photos, batch, 'RIGHTS_EVIDENCE'); const body: DTO<'RightsRecordRequest'> = { scope, statement: statement.trim(), evidence_asset_ids: ids,
        ...(scope !== 'THIRD_PARTY_RESOURCE' && productId ? { product_id: productId } : {}), ...(scope === 'THIRD_PARTY_RESOURCE' ? { resource_version_ids: resourceIds } : {}), ...(reference.trim() ? { license_reference: reference.trim() } : {}) };
      await client().api.call('submitRightsRecord', { body, key: client().intent('rights-submit', { batch, body }) }); setSubmitted(true); setPhotos([]); list.reload();
    })}>{action.busy ? '正在提交…' : submitted ? '已提交核验' : '提交授权资料'}</Action></Panel>{submitted && <Notice>资料已提交，审核结果会保留在下面的记录中。</Notice>}{action.error && <Notice error>{action.error}</Notice>}
    {route.params.draft_id && <Action secondary onClick={() => navigate('draft', { draft_id: route.params.draft_id! })}>返回方案草稿</Action>}
    <Text className='section-title'>我的授权记录</Text><ResourceState {...list} retry={list.reload} />{list.loaded && !list.items.length && <Text className='secondary'>还没有授权记录。</Text>}{list.items.map(r => <Panel key={r.rights_record_id}><Text className='card-title'>{rightsScope[r.scope as keyof typeof rightsScope] ?? '授权资料'}</Text><Text>{rightsText[r.state]}</Text><Text className='caption'>{r.product_id ? '已关联本次商品照片 · ' : ''}{new Date(r.updated_at).toLocaleString()}</Text></Panel>)}<More {...list} />
  </>;
}
export function Publication() {
  const route = useRouter(); const action = useAction(); const [confirmWithdrawal,setConfirmWithdrawal] = useState(false);
  const resource = useResource(async () => { await client().login(); return client().api.call('getPresetPublication', { params: { publication_id: route.params.publication_id ?? '' } }); }, p => ['UNDER_REVIEW', 'SUBMITTED'].includes(p.state) || p.public_sample_state==='PREPARING');
  const p = resource.data;
  return <><Text className='page-headline'>每一次发布，<Text className='marked'>都有记录。</Text></Text><ResourceState {...resource} retry={resource.reload} />{p && <><Panel><Text className='card-title'>{publicationText[p.state] ?? '发布状态已更新'}</Text>
    <Text>{p.sale_enabled ? '方案已开放制作' : '方案尚未开放制作'}</Text><Text className='secondary'>{p.admission_state === 'ADMITTED' ? '制作能力准入已通过' : '制作能力准入尚未通过，审核通过也不会直接开放付款。'}</Text></Panel>
    {p.review_message && <Panel><Text className='card-title'>审核说明</Text><Text>{p.review_message}</Text></Panel>}
    {p.public_sample_state && p.public_sample_state!=='NONE' && <Panel><Text className='card-title'>公开样例</Text>
      <Text>{{PREPARING:'审核通过，正在准备公开样例',READY:'样例已准备，等待发布',PUBLISHED:'样例正在公开展示',WITHDRAWN:'样例已撤回',EXPIRED:'样例已到期',FAILED:'样例准备未完成'}[p.public_sample_state]}</Text>
      {p.public_sample_expires_at && <Text className='caption'>授权截止：{new Date(p.public_sample_expires_at).toLocaleString()}</Text>}
      {['PREPARING','READY','PUBLISHED'].includes(p.public_sample_state) && <>{confirmWithdrawal ? <><Text>撤回后样例立即停止分发，方案停止新制作。已有订单按原合同处理。</Text><Action disabled={action.busy} onClick={()=>void action.run(async()=>{
        await client().api.call('withdrawPublicSamples',{params:{publication_id:p.publication_id},body:{expected_revision:p.revision,reason:'作者在发布记录中主动撤回公开样例'},key:client().intent('public-sample-withdrawal',{publicationId:p.publication_id,revision:p.revision})});
        setConfirmWithdrawal(false);resource.reload();
      })}>{action.busy?'正在撤回…':'确认撤回公开样例'}</Action><Action secondary disabled={action.busy} onClick={()=>setConfirmWithdrawal(false)}>保留公开展示</Action></>:
      <Action secondary onClick={()=>setConfirmWithdrawal(true)}>撤回公开样例</Action>}</>}
    </Panel>}{action.error && <Notice error>{action.error}</Notice>}
    {p.reason_codes.length > 0 && <Notice>{p.reason_codes.includes('LICENSE_RETIRED') ? '所选许可已停止用于新发布或交易，请重新选择有效许可并提交新版本。' : '请按审核说明补充资料或修改方案，保存后提交新版本。'}</Notice>}
    <Action secondary onClick={() => navigate('draft', { draft_id: p.draft_id })}>查看原草稿</Action>{p.preset_id && p.published_version && <Action onClick={() => navigate('preset', { preset_id: p.preset_id!, version: p.published_version! })}>查看已发布版本</Action>}</>}
  </>;
}
export function Moderation() {
  const route = useRouter(); const action = useAction(); const [mode, setMode] = useState<'mine' | 'author'>('mine'); const modeRef = useRef(mode); modeRef.current = mode;
  const [reason, setReason] = useState<DTO<'ReportRequest'>['reason']>('OTHER'); const [text, setText] = useState(''); const [reportSent, setReportSent] = useState(false);
  const [appealFor, setAppealFor] = useState(''); const [appealMessage, setAppealMessage] = useState('');
  const reports = usePagedResource(async cursor => { await client().login(); return client().api.call(modeRef.current === 'mine' ? 'listReports' : 'listAuthorReports', { query: { limit: 20, cursor } }); }, r => r.report_id);
  const appeals = usePagedResource(async cursor => { await client().login(); return client().api.call('listAppeals', { query: { limit: 20, cursor } }); }, a => a.appeal_id);
  return <><Text className='page-headline'>一起守护，<Text className='marked'>可信的创作。</Text></Text>{route.params.preset_id && route.params.version && <Panel><Text className='card-title'>举报这个方案版本</Text>
    <View className='filters'>{([['RIGHTS', '来源侵权'], ['MISLEADING', '误导效果'], ['UNSAFE', '不当内容'], ['PRODUCT_DISTORTION', '商品失真'], ['OTHER', '其他问题']] as const).map(([value, label]) => <Button key={value} className={`filter ${reason === value ? 'active' : ''}`} onClick={() => { setReason(value); setReportSent(false); }}>{label}</Button>)}</View>
    <Textarea className='feedback-input' maxlength={2000} value={text} onInput={e => { setText(e.detail.value); setReportSent(false); }} placeholder='说明具体问题与发生位置，请勿填写密码或付款凭证' />
    <Action disabled={action.busy || !text.trim() || reportSent} onClick={() => void action.run(async () => { await client().login(); const body = { preset_version: route.params.version!, reason, message: text.trim() };
      await client().api.call('reportPreset', { params: { preset_id: route.params.preset_id! }, body, key: client().intent('report', { presetId: route.params.preset_id, body }) }); setReportSent(true); reports.reload();
    })}>{reportSent ? '举报已提交' : action.busy ? '正在提交…' : '提交举报'}</Action></Panel>}
    <View className='filters'>{([['mine', '我的举报'], ['author', '涉及我的方案']] as const).map(([value, label]) => <Button key={value} className={`filter ${mode === value ? 'active' : ''}`} onClick={() => { modeRef.current = value; setMode(value); setAppealFor(''); reports.reload(); }}>{label}</Button>)}</View>
    <ResourceState {...reports} retry={reports.reload} />{reports.loaded && !reports.items.length && <Notice>{mode === 'mine' ? '还没有举报记录。可从方案详情提交具体问题。' : '你的方案暂无治理记录。'}</Notice>}
    {reports.items.map(r => <Panel key={r.report_id}><Text className='card-title'>{reportText[r.state]}</Text><Text className='caption'>{new Date(r.updated_at).toLocaleString()}</Text>
      {['RESOLVED', 'DISMISSED'].includes(r.state) && <><Button className='text-action' onClick={() => { setAppealFor(r.report_id); setAppealMessage(''); }}>对处理决定申诉</Button>{appealFor === r.report_id && <><Textarea className='feedback-input' maxlength={2000} value={appealMessage} onInput={e => setAppealMessage(e.detail.value)} placeholder='说明你认为需要复核的事实与理由' /><Action disabled={action.busy || !appealMessage.trim()} onClick={() => void action.run(async () => {
        const body = { message: appealMessage.trim() }; await client().api.call('appealReportDecision', { params: { report_id: r.report_id }, body, key: client().intent('appeal', { reportId: r.report_id, body }) }); setAppealFor(''); reports.reload(); appeals.reload();
      })}>提交申诉</Action></>}</>}
    </Panel>)}<More {...reports} />{action.error && <Notice error>{action.error}</Notice>}
    <Text className='section-title'>我的申诉</Text><ResourceState {...appeals} retry={appeals.reload} />{appeals.items.map(a => <Panel key={a.appeal_id}><Text className='card-title'>{appealText[a.state]}</Text><Text className='secondary'>处理结果将保留在本记录中。</Text></Panel>)}<More {...appeals} />
  </>;
}
