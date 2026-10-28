import React, { useEffect, useState, type ReactNode } from 'react';
import { View, Text, Button, Switch } from '@tarojs/components';
import type { DTO } from '../contracts/types';
import { client } from './runtime';
import { Action, Notice, Panel, ResourceState, More, navigate, useAction, useResource, usePagedResource } from './base';

const scopeName: Record<string, string> = { OWNED_PRODUCT: '商品使用权', SAMPLE_PUBLICATION: '样例公开授权', THIRD_PARTY_RESOURCE: '第三方资源许可' };
const flip = (ids: string[], id: string) => ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id];
export function CreatorWorkflow({ draft, blueprints, disabled, renderSample }: { draft: DTO<'PresetDraft'>; blueprints: DTO<'VariantBlueprint'>[]; disabled: boolean; renderSample: (id: string) => ReactNode }) {
  const action = useAction(); const [productId, setProductId] = useState(''); const [blueprint, setBlueprint] = useState('');
  const [rightsIds, setRightsIds] = useState<string[]>([]); const [sampleIds, setSampleIds] = useState<string[]>([]);
  const [licenseId, setLicenseId] = useState(''); const [accepted, setAccepted] = useState(false);
  const [sampleAccepted,setSampleAccepted] = useState(false);
  const products = usePagedResource(async cursor => { await client().login(); return client().api.call('listProducts', { query: { limit: 20, cursor } }); }, p => p.product_id);
  const rights = usePagedResource(async cursor => { await client().login(); return client().api.call('listRightsRecords', { query: { limit: 20, cursor } }); }, r => r.rights_record_id);
  const samples = usePagedResource(async cursor => { await client().login(); return client().api.call('listPresetSamples', { params: { draft_id: draft.draft_id }, query: { limit: 20, cursor } }); }, s => s.sample_id);
  const licenses = usePagedResource(cursor => client().api.call('listPresetLicenses', { query: { limit: 20, cursor } }), l => l.license_id);
  const profile = useResource(async () => productId ? client().api.call('getProductProfile', { params: { product_id: productId } }) : null);
  const terms = useResource(async () => licenseId ? client().api.call('getPresetLicense', { params: { license_id: licenseId } }) : null);
  // This section mounts after the draft request completes, which may be after
  // the host's page-show event. Start its read queries on mount as well.
  useEffect(() => { products.reload(); rights.reload(); licenses.reload(); }, [products.reload, rights.reload, licenses.reload]);
  useEffect(() => { profile.reload(); }, [productId]);
  useEffect(() => { terms.reload(); setAccepted(false); }, [licenseId, draft.revision]);
  useEffect(() => { setSampleAccepted(false); }, [licenseId,draft.revision,sampleIds.join(',')]);
  useEffect(() => { setSampleIds([]); setBlueprint(draft.config.variant_blueprint_ids[0] ?? ''); samples.reload(); }, [draft.draft_id, draft.revision, samples.reload]);
  const selectedRights = rights.items.filter(r => rightsIds.includes(r.rights_record_id) && ['SUBMITTED', 'VERIFIED'].includes(r.state));
  const productRights = selectedRights.filter(r => r.product_id === productId && r.photo_version === profile.data?.photo_version);
  const productScopes = new Set(productRights.map(r => r.scope));
  const canSample = !disabled && productId && profile.data?.product_id === productId && blueprint && productScopes.has('OWNED_PRODUCT') && productScopes.has('SAMPLE_PUBLICATION');
  const license = terms.data?.license_id === licenseId ? terms.data : null;
  const readySamples = samples.items.filter(s => s.state === 'READY' && s.draft_revision === draft.revision && sampleIds.includes(s.sample_id));
  const coverage = new Set(readySamples.map(s => s.variant_blueprint_id));
  const canPublish = !disabled && !draft.publication_id && accepted && sampleAccepted && license?.state === 'ACTIVE' && license.fork_allowed === draft.config.fork_allowed
    && draft.config.variant_blueprint_ids.every(id => coverage.has(id)) && rightsIds.length > 0;
  return <><Text className='section-title'>用自己的商品，验证这套方案</Text>
    {disabled && <Notice>请先保存当前修改，再使用已保存的版本制作样例或申请发布。</Notice>}
    <Panel><Text className='card-title'>选择已识别的商品</Text><ResourceState {...products} retry={products.reload} />
      {products.loaded && !products.items.some(p => p.profile_id) && <Text className='secondary'>先拍摄商品并完成识别，再回来选择自己的素材。</Text>}
      {products.items.filter(p => p.profile_id).map(p => <Button key={p.product_id} className={`choice-button ${productId === p.product_id ? 'selected' : ''}`} onClick={() => { setProductId(p.product_id); setAccepted(false); }}>
        {productId === p.product_id ? '已选 · ' : ''}商品照片 · {new Date(p.created_at).toLocaleString()}</Button>)}<More {...products} />
      {productId && <><ResourceState {...profile} retry={profile.reload} />{profile.data?.product_id === productId && <Text className='secondary'>{profile.data.name ?? '你的商品'} · {profile.data.summary}</Text>}</>}
      <Action secondary onClick={() => navigate('photos')}>拍摄一组商品照片</Action>
    </Panel>
    <Panel><Text className='card-title'>选择授权资料</Text><Text className='secondary'>当前商品需要商品使用权和样例公开授权；发布时还需包含所用样例和资源的全部许可。</Text>
      <ResourceState {...rights} retry={rights.reload} />{rights.items.filter(r => ['SUBMITTED', 'VERIFIED'].includes(r.state)).map(r => <Button key={r.rights_record_id}
        className={`choice-button ${rightsIds.includes(r.rights_record_id) ? 'selected' : ''}`} onClick={() => { setRightsIds(flip(rightsIds, r.rights_record_id)); setAccepted(false); }}>
        {rightsIds.includes(r.rights_record_id) ? '已选 · ' : ''}{scopeName[r.scope] ?? '授权资料'} · {r.product_id === productId && productId ? '当前商品' : r.product_id ? '其他商品' : '未关联商品'} · {new Date(r.updated_at).toLocaleDateString()}
      </Button>)}<More {...rights} /><Action secondary onClick={() => navigate('rights', { ...(productId ? { product_id: productId } : {}), draft_id: draft.draft_id })}>补充授权资料</Action>
    </Panel>
    <Panel><Text className='card-title'>制作一份私有样例</Text><Text className='secondary'>每种制作规格分别验证。样例通过检查和公开授权审核后才可展示。</Text>
      {draft.config.variant_blueprint_ids.map(id => <Button key={id} className={`choice-button ${blueprint === id ? 'selected' : ''}`} onClick={() => setBlueprint(id)}>{blueprint === id ? '已选 · ' : ''}{blueprints.find(b => b.blueprint_id === id)?.name ?? `制作规格 ${draft.config.variant_blueprint_ids.indexOf(id) + 1}`}</Button>)}
      <Action disabled={action.busy || !canSample} onClick={() => void action.run(async () => {
        if (profile.data?.profile_id && profile.data.product_id === productId) {
          const body: DTO<'SampleRequest'> = { draft_revision: draft.revision, product_id: productId, profile_id: profile.data.profile_id,
            variant_blueprint_id: blueprint, rights_record_ids: productRights.map(r => r.rights_record_id) };
          await client().api.call('createPresetSample', { params: { draft_id: draft.draft_id }, body, key: client().intent('creator-sample', { draftId: draft.draft_id, body }) }); samples.reload();
        }
      })}>{action.busy ? '正在提交…' : '制作私有样例'}</Action>
    </Panel>
    <Text className='section-title'>这份草稿的样例</Text><ResourceState {...samples} retry={samples.reload} />
    {samples.loaded && !samples.items.length && <Text className='secondary'>还没有样例，制作结果会保留在这里。</Text>}
    {samples.items.map(s => <Panel key={s.sample_id}><Text className='card-title'>{s.state === 'READY' ? '样例已生成' : s.state === 'FAILED' ? '样例制作未完成' : s.state === 'GENERATING' ? '正在制作样例' : '样例等待制作'}</Text>
      <Text className='secondary'>{s.visibility === 'PRIVATE' ? '私有样例' : '已授权公开样例'}{s.draft_revision !== draft.revision ? ' · 来自其他草稿版本' : ''}</Text>
      {s.state === 'READY' && <>{renderSample(s.sample_id)}{s.draft_revision === draft.revision && <Button className={`choice-button ${sampleIds.includes(s.sample_id) ? 'selected' : ''}`} onClick={() => { setSampleIds(flip(sampleIds, s.sample_id)); setAccepted(false); }}>{sampleIds.includes(s.sample_id) ? '已选入本次发布' : '选入本次发布'}</Button>}</>}
    </Panel>)}<More {...samples} /><Action secondary onClick={samples.reload}>刷新样例记录</Action>
    <Text className='section-title'>阅读许可并申请发布</Text><Panel><Text className='secondary'>选择与方案派生设置一致的有效许可。发布审核与开放收费分别核验。</Text>
      <ResourceState {...licenses} retry={licenses.reload} />{licenses.loaded && !licenses.items.some(l => l.state === 'ACTIVE' && l.fork_allowed === draft.config.fork_allowed) && <Notice>暂未开放适合当前派生设置的许可，草稿会继续保留。</Notice>}
      {licenses.items.map(l => <Button key={l.license_id} disabled={l.state !== 'ACTIVE' || l.fork_allowed !== draft.config.fork_allowed} className={`choice-button ${licenseId === l.license_id ? 'selected' : ''}`} onClick={() => setLicenseId(l.license_id)}>{licenseId === l.license_id ? '已选 · ' : ''}{l.name} · {l.version}{l.state !== 'ACTIVE' ? ' · 尚未开放' : ''}</Button>)}<More {...licenses} />
      {licenseId && <><ResourceState {...terms} retry={terms.reload} />{license && <><Text className='card-title'>{license.name} · {license.version}</Text><Text className='license-copy' selectable>{license.full_text}</Text>
        <View className='consent'><Switch checked={accepted} color='#236449' onChange={e => setAccepted(e.detail.value)} /><Text>我已阅读并同意本版本方案许可，确认有权提交所选方案与素材。</Text></View>
        <View className='consent'><Switch checked={sampleAccepted} color='#236449' onChange={e => setSampleAccepted(e.detail.value)} /><Text>同意审核后将所选样例的独立副本公开展示，最多30天。原商品照片保持私有；可在发布记录中随时撤回，撤回或到期将停止方案的新制作。</Text></View></>}</>}
      <Action disabled={action.busy || !canPublish} onClick={() => void action.run(async () => {
        if (!license || !accepted || !sampleAccepted) return;
        const body: DTO<'PublicationRequest'> = { expected_revision: draft.revision, sample_ids: readySamples.map(s => s.sample_id), rights_record_ids: rightsIds,
          license_version: license.license_id, license_content_hash: license.content_hash, accept_license: true, accept_sample_publication:true,public_sample_retention_days:30 };
        const publication = await client().api.call('submitPresetPublication', { params: { draft_id: draft.draft_id }, body, key: client().intent('creator-publication', { draftId: draft.draft_id, body }) });
        navigate('publication', { publication_id: publication.publication_id });
      })}>{action.busy ? '正在提交…' : '提交发布申请'}</Action>
      {!draft.config.variant_blueprint_ids.every(id => coverage.has(id)) && <Text className='caption'>请选择当前版本每种制作规格的合格样例。</Text>}
      {draft.publication_id && <Action secondary onClick={() => navigate('publication', { publication_id: draft.publication_id! })}>查看本次发布</Action>}
    </Panel>{action.error && <Notice error>{action.error}</Notice>}
  </>;
}
