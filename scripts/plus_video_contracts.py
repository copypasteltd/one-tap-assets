"""Video edit drafts and independent mobile-approved delivery requests."""
import copy


def extend_video_contract(a, m, e):
    ref = lambda n: {'$ref': '#/components/schemas/' + n}
    obj = lambda p: {'type': 'object', 'properties': p, 'required': list(p), 'additionalProperties': False}
    old = a['components']['schemas']
    rid = copy.deepcopy(old['PlusEditDraft']['properties']['draft_id'])
    frame = {'type': 'integer', 'minimum': 0, 'maximum': 3600}
    settings = copy.deepcopy(old['PlusEditSettings']['properties'])
    settings['canvas'] = obj({k: {'type': 'integer', 'minimum': 256, 'maximum': 1920} for k in ['width', 'height']})
    settings.update(trim=obj({'start_frame': frame, 'end_frame': frame}), audio_mode={'type': 'string', 'enum': ['PRESERVE', 'MUTE']},
                    captions={'type': 'array', 'maxItems': 40, 'items': obj({'start_frame': frame, 'end_frame': frame,
                              'text': {'type': 'string', 'minLength': 1, 'maxLength': 200},
                              'kind': {'type': 'string', 'enum': ['SUBTITLE', 'ON_SCREEN_COPY']}})})
    draft = copy.deepcopy(old['PlusEditDraft']['properties'])
    draft.update(settings=ref('PlusVideoSettings'), media_kind={'const': 'video'}, source=ref('PlusVideoSource'))
    plan = copy.deepcopy(old['PlusRenderPlan']['properties']); plan['settings'] = ref('PlusVideoSettings')
    schemas = {
      'PlusVideoSettings': obj(settings),
      'PlusVideoSource': obj({'width': {'type': 'integer', 'minimum': 1, 'maximum': 3840},
         'height': {'type': 'integer', 'minimum': 1, 'maximum': 3840}, 'fps': {'const': 30},
         'frames': {'type': 'integer', 'minimum': 30, 'maximum': 3600}, 'has_audio': {'type': 'boolean'},
         'size_bytes': {'type': 'integer', 'minimum': 1, 'maximum': 512000000}}),
      'PlusVideoDraft': obj(draft),
      'PlusVideoSaveRequest': obj({'expected_revision': copy.deepcopy(old['PlusEditSaveRequest']['properties']['expected_revision']), 'settings': ref('PlusVideoSettings')}),
      'PlusVideoList': obj({'items': {'type': 'array', 'maxItems': 100, 'items': ref('PlusVideoDraft')}, 'next_cursor': copy.deepcopy(old['PlusEditList']['properties']['next_cursor'])}),
      'PlusVideoRenderPlan': obj(plan),
      'PlusVideoRenderPlanList': obj({'items': {'type': 'array', 'maxItems': 100, 'items': ref('PlusVideoRenderPlan')}, 'next_cursor': copy.deepcopy(old['PlusRenderPlanList']['properties']['next_cursor'])})
    }
    operations = [
      ('createPlusVideoDraft', 'POST', '/plus/video-drafts', 'PlusEditCreateRequest', 'PlusVideoDraft', '为本人当前已交付视频建立独立剪辑草稿'),
      ('getPlusVideoDraft', 'GET', '/plus/video-drafts/{draft_id}', None, 'PlusVideoDraft', '读取本人视频剪辑草稿及可信来源规格'),
      ('savePlusVideoDraft', 'PUT', '/plus/video-drafts/{draft_id}', 'PlusVideoSaveRequest', 'PlusVideoDraft', '按修订号保存选段、裁切、定时字幕和原声选择'),
      ('listPlusVideoDrafts', 'GET', '/plus/video-drafts', None, 'PlusVideoList', '分页读取本人有效视频编辑草稿'),
      ('listPlusVideoStyles', 'GET', '/plus/video-render-styles', None, 'PlusRenderStyleList', '读取独立视频编辑制作风格与价格'),
      ('createPlusVideoPlan', 'POST', '/plus/video-drafts/{draft_id}/render-plans', 'PlusRenderCreateRequest', 'PlusVideoRenderPlan', '经手机单独授权冻结视频编辑清单，回原渠道核对报价并付款'),
      ('listPlusVideoPlans', 'GET', '/plus/video-render-plans', None, 'PlusVideoRenderPlanList', '本人在电脑或原小程序恢复视频制作清单'),
      ('getPlusVideoPlan', 'GET', '/plus/video-render-plans/{request_id}', None, 'PlusVideoRenderPlan', '读取本人视频制作清单及原渠道独立订单状态')
    ]
    for _, _, _, _, response, _ in operations:
        if response not in old: schemas[response + 'Response'] = obj({'data': ref(response), 'trace_id': {'type': 'string'}})
    for doc in [a, m]:
        doc['components']['schemas'].update(copy.deepcopy(schemas))
        s = doc['components']['schemas']
        s['PlusLinkCreateRequest']['properties']['prepare_video_render_plans'] = {'type': 'boolean'}
        for name in ['PlusLinkApproval', 'PlusSessionInfo']:
            s[name]['properties']['can_prepare_video_render_plans'] = {'type': 'boolean'}
        s['Plan']['properties']['plus_video_request_id'] = copy.deepcopy(rid)
    template = next(x for x in e['endpoints'] if x['operation_id'] == 'getPlusRenderPlan')
    original = copy.deepcopy(a['paths']['/plus/render-plans/{request_id}']['get'])
    for op, method, path, request, response, summary in operations:
        operation = copy.deepcopy(original)
        params = [{'name': part[1:-1], 'in': 'path', 'required': True, 'schema': rid} for part in path.split('/') if part.startswith('{')]
        if op in ['listPlusVideoDrafts', 'listPlusVideoPlans']: params += copy.deepcopy(a['paths']['/products']['get'].get('parameters', []))
        operation.update(operationId=op, summary=summary, description=summary, parameters=params)
        operation.pop('requestBody', None)
        if request: operation['requestBody'] = {'required': True, 'content': {'application/json': {'schema': ref(request)}}}
        operation['responses']['200']['content']['application/json']['schema'] = ref(response + 'Response')
        a['paths'].setdefault(path, {})[method.lower()] = operation
        row = copy.deepcopy(template)
        row.update(method=method, path=path, operation_id=op, summary=summary, request_schema=request, response_schema=response)
        e['endpoints'].append(row)


def extend_video_data(model):
    for entry in model['entities']:
        if entry['table'] in ['plus_links', 'plus_sessions']: entry['fields'].append('allow_video_render_plans')
        if entry['table'] in ['plus_edit_drafts', 'plus_render_plans']: entry['fields'].append('media_kind')
