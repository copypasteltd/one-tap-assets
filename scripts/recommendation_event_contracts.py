"""Recommendation telemetry is optional and never authorizes buying or generation."""
import copy


def extend_recommendation_event_contract(a, m, e):
    def ref(n): return {'$ref': '#/components/schemas/' + n}
    def obj(p): return {'type': 'object', 'properties': p, 'required': list(p), 'additionalProperties': False}
    integer = {'type': 'integer', 'minimum': 0, 'maximum': 2147483647}
    timestamp = {'type': 'string', 'format': 'date-time', 'maxLength': 40}
    schemas = {
        'RecommendationMeasurement': obj({'token': {'type': 'string', 'minLength': 32, 'maxLength': 4096}, 'expires_at': timestamp}),
        'RecommendationEventRequest': obj({'measurement_token': {'type': 'string', 'minLength': 32, 'maxLength': 4096}, 'kind': {'type': 'string', 'enum': ['IMPRESSION', 'CLICK']}}),
        'RecommendationEventReceipt': obj({'accepted': {'const': True}, 'duplicate': {'type': 'boolean'}}),
        'RecommendationMeasurementCoverage': obj({'started_at': timestamp, 'window_coverage': {'type': 'string', 'enum': ['UNCOLLECTED', 'PARTIAL', 'SINCE_START']}, 'evidence': {'const': 'CLIENT_REPORTED'}})
    }
    schemas['RecommendationEventReceiptResponse'] = obj({'data': ref('RecommendationEventReceipt'), 'trace_id': {'type': 'string'}})
    for doc in [a, m]:
        doc['components']['schemas'].update(copy.deepcopy(schemas))
        doc['components']['schemas']['Recommendation']['properties']['measurement'] = ref('RecommendationMeasurement')
        insight = doc['components']['schemas']['ProductInsights']
        insight['properties']['recommendation_measurement'] = ref('RecommendationMeasurementCoverage')
        insight['required'].append('recommendation_measurement')
        for key in ['recommendation_impressions', 'recommendation_clicks']:
            insight['properties']['funnel']['properties'][key] = {'anyOf': [integer, {'type': 'null'}]}
    summary = '记录本人当前推荐的可见停留或点击；自然键去重，不影响制作'
    path = '/products/{product_id}/recommendation-events'
    operation = copy.deepcopy(a['paths']['/products/{product_id}/preset-recommendations']['get'])
    operation.update(operationId='recordRecommendationEvent', summary=summary, description=summary)
    operation['parameters'] = [x for x in operation['parameters'] if x.get('in') == 'path']
    operation['requestBody'] = {'required': True, 'content': {'application/json': {'schema': ref('RecommendationEventRequest')}}}
    operation['responses']['200']['content']['application/json']['schema'] = ref('RecommendationEventReceiptResponse')
    operation['x-requirements'] = ['P01-F17', 'P01-F21']; operation['x-idempotency-required'] = False
    a['paths'][path] = {'post': operation}
    row = copy.deepcopy(next(x for x in e['endpoints'] if x['operation_id'] == 'recommendPresets'))
    row.update(method='POST', path=path, operation_id='recordRecommendationEvent', summary=summary, request_schema='RecommendationEventRequest', response_schema='RecommendationEventReceipt', requirements=['P01-F17', 'P01-F21'])
    e['endpoints'].append(row)


def extend_recommendation_event_data(model):
    for name, fields, invariant in [
        ('recommendation_events', ['tenant_id','owner_id','product_id','profile_id','preset_version_id','policy','kind','received_at'], 'Signed eligible recommendation; current owner/profile/photo/version; immutable server time; unique owner/product/profile/preset/policy/kind; deletion erases events.'),
        ('metrics_collection_epochs', ['id','started_at'], 'Immutable collection start; pre-collection windows remain null; deployment start does not prove every client is instrumented.')
    ]:
        model['entities'].append({'table': name, 'primary_key': 'id' if name == 'metrics_collection_epochs' else 'product_id', 'scope': 'global' if name == 'metrics_collection_epochs' else 'tenant', 'fields': fields, 'invariant': invariant, 'implementation_status': 'DESIGN_NOT_IMPLEMENTED'})


def recommendation_event_catalog():
    return '\n\n## 推荐体验记录增补\n\n| 方法/路径 | operationId | 请求 → 响应 | 权限 |\n| --- | --- | --- | --- |\n| POST /products/{product_id}/recommendation-events | recordRecommendationEvent | RecommendationEventRequest → RecommendationEventReceipt | 本人当前商品及签名推荐 |\n\nGET 推荐保持只读。可见比例至少 50% 且连续停留 500ms 后报曝光；点击独立，不推断曝光或转化率。服务端自然键去重；客户端体验证据不是已验证真人或付费凭证。历史采集前保持 null。\n'
