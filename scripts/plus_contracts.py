"""Explicit mini-program approval and owner-scoped Plus editing drafts."""
import copy

def extend_plus_contract(a, m, e):
    def ref(n): return {'$ref': '#/components/schemas/' + n}
    def obj(p, required=None): return {'type': 'object', 'properties': p, 'required': list(p) if required is None else required, 'additionalProperties': False}
    rid = {'type':'string','pattern':'^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$'}
    time = {'type':'string','format':'date-time','maxLength':40}
    code = {'type':'string','pattern':'^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$'}
    key = {'type':'string','pattern':'^[A-Za-z0-9_-]{43}$'}
    integer = {'type':'integer','minimum':1,'maximum':2147483647}
    text = lambda n: {'type':'string','maxLength':n}
    settings = obj({'crop':obj({k:{'type':'number','minimum':0 if k in ['x','y'] else .01,'maximum':1} for k in ['x','y','width','height']}),
                    'canvas':obj({k:{'type':'integer','minimum':256,'maximum':3840} for k in ['width','height']}),
                    'title':text(80),'brand':text(60),'facts':{'type':'array','maxItems':8,'items':{'type':'string','minLength':1,'maxLength':200}}})
    info = obj({'session_id':rid,'platform':ref('Platform'),'created_at':time,'expires_at':time,'state':{'type':'string','enum':['ACTIVE','REVOKED','EXPIRED']},'can_prepare_render_plans':{'type':'boolean'}})
    browser = obj({**copy.deepcopy(a['components']['schemas']['Session']['properties']),'connection':ref('PlusSessionInfo')})
    schemas = {
      'PlusLinkCreateRequest':obj({'prepare_render_plans':{'type':'boolean'}},[]),
      'PlusLink':obj({'link_id':rid,'user_code':code,'poll_key':key,'expires_at':time,'poll_interval_seconds':{'const':3}}),
      'PlusLinkInspectRequest':obj({'user_code':code}),
      'PlusLinkDecisionRequest':obj({'user_code':code,'decision':{'type':'string','enum':['APPROVE','DENY']}}),
      'PlusLinkApproval':obj({'link_id':rid,'user_code':code,'expires_at':time,'state':{'type':'string','enum':['PENDING','APPROVED','DENIED']},'access':{'const':'OWN_PROJECTS_AND_EDIT_DRAFTS'},'can_prepare_render_plans':{'type':'boolean'}}),
      'PlusLinkPollRequest':obj({'poll_key':key}),
      'PlusSessionInfo':info,'PlusBrowserSession':browser,
      'PlusLinkStatus':obj({'state':{'type':'string','enum':['PENDING','APPROVED','DENIED']},'session':ref('PlusBrowserSession')},['state']),
      'PlusSessionList':obj({'items':{'type':'array','maxItems':5,'items':ref('PlusSessionInfo')},'next_cursor':{'type':'null'}}),
      'PlusEditSettings':settings,
      'PlusEditCreateRequest':obj({'order_id':rid,'deliverable_id':rid}),
      'PlusEditSaveRequest':obj({'expected_revision':integer,'settings':ref('PlusEditSettings')}),
      'PlusEditDraft':obj({'draft_id':rid,'order_id':rid,'product_id':rid,'manifest_id':rid,'manifest_revision':integer,'deliverable_id':rid,
                         'source_sha256':{'type':'string','pattern':'^[a-f0-9]{64}$'},'revision':integer,'settings':ref('PlusEditSettings'),
                         'fact_status':{'const':'USER_PROVIDED_UNVERIFIED'},'state':{'const':'DRAFT'},'created_at':time,'updated_at':time}),
      'PlusEditList':obj({'items':{'type':'array','maxItems':100,'items':ref('PlusEditDraft')},'next_cursor':{'anyOf':[{'type':'string','maxLength':4096},{'type':'null'}]}})
    }
    schemas.update({
      'PlusRenderCreateRequest':obj({'expected_revision':integer,'variant_id':rid,'variant_version':rid}),
      'PlusRenderStyle':obj({'preset_id':rid,'preset_version':rid,'variant_id':rid,'variant_version':rid,'name':text(200),
                            'sale_enabled':{'type':'boolean'},'price_fen':{'anyOf':[{'type':'integer','minimum':1,'maximum':2147483647},{'type':'null'}]},
                            'reason_codes':{'type':'array','maxItems':30,'items':text(100)}}),
      'PlusRenderStyleList':obj({'items':{'type':'array','maxItems':100,'items':ref('PlusRenderStyle')}}),
      'PlusRenderPlan':obj({'request_id':rid,'draft_id':rid,'draft_revision':integer,'source_order_id':rid,'created_at':time,
                           'settings':ref('PlusEditSettings'),'price_fen':integer,'pricing_version':text(100),'plan':ref('Plan'),
                           'order':{'anyOf':[ref('Order'),{'type':'null'}]}}),
      'PlusRenderPlanList':obj({'items':{'type':'array','maxItems':100,'items':ref('PlusRenderPlan')},
                               'next_cursor':{'anyOf':[{'type':'string','maxLength':4096},{'type':'null'}]}})
    })
    batch_item=obj({'draft_id':rid,**copy.deepcopy(schemas['PlusRenderCreateRequest']['properties'])})
    count={'type':'integer','minimum':0,'maximum':10}
    batch_summary=obj({'batch_id':rid,'created_at':time,'item_count':{'type':'integer','minimum':2,'maximum':10},
      'prepared_count':count,'preparation_failed_count':count,'removed_count':count})
    schemas.update({
      'PlusBatchItemRequest':batch_item,
      'PlusBatchFailure':obj({'code':{'type':'string','pattern':'^[A-Z][A-Z0-9_]{0,79}$'},'message':text(2000)}),
      'PlusBatchCreateRequest':obj({'request_key':{'type':'string','pattern':'^[A-Za-z0-9][A-Za-z0-9_-]{21,127}$'},
        'items':{'type':'array','minItems':2,'maxItems':10,'uniqueItems':True,'items':ref('PlusBatchItemRequest')}}),
      'PlusBatchSummary':batch_summary,
      'PlusBatchItem':obj({'position':{'type':'integer','minimum':1,'maximum':10},'state':{'type':'string','enum':['PREPARED','PREPARATION_FAILED','SOURCE_REMOVED']},
        'input':{'anyOf':[ref('PlusBatchItemRequest'),{'type':'null'}]},'render':{'anyOf':[ref('PlusRenderPlan'),{'type':'null'}]},
        'failure':{'anyOf':[ref('PlusBatchFailure'),{'type':'null'}]}}),
      'PlusBatch':obj({**copy.deepcopy(batch_summary['properties']),'items':{'type':'array','minItems':2,'maxItems':10,'items':ref('PlusBatchItem')}}),
      'PlusBatchList':obj({'items':{'type':'array','maxItems':100,'items':ref('PlusBatchSummary')},'next_cursor':copy.deepcopy(schemas['PlusRenderPlanList']['properties']['next_cursor'])})
    })
    for doc in [a,m]:doc['components']['schemas']['Plan']['properties']['plus_render_request_id']=rid
    operations = [
      ('createPlusLink','POST','/plus/links','PlusLinkCreateRequest','PlusLink',True,'创建短期电脑接续码'),
      ('inspectPlusLink','POST','/plus/links/inspect','PlusLinkInspectRequest','PlusLinkApproval',False,'小程序查看本人准备确认的电脑接续'),
      ('decidePlusLink','POST','/plus/links/decision','PlusLinkDecisionRequest','PlusLinkApproval',False,'小程序主动允许或拒绝电脑接续'),
      ('pollPlusLink','POST','/plus/links/{link_id}/poll','PlusLinkPollRequest','PlusLinkStatus',True,'电脑持独立秘密等待确认；原确认不续期'),
      ('getPlusSession','GET','/plus/session',None,'PlusSessionInfo',False,'读取当前电脑连接'),
      ('listPlusSessions','GET','/plus/sessions',None,'PlusSessionList',False,'小程序读取本人有效电脑连接'),
      ('revokePlusSession','DELETE','/plus/sessions/{plus_session_id}',None,'PlusSessionInfo',False,'撤销本人电脑连接及其短期下载权限'),
      ('createPlusEditDraft','POST','/plus/edit-drafts','PlusEditCreateRequest','PlusEditDraft',False,'为本人已交付图片建立独立编辑草稿'),
      ('getPlusEditDraft','GET','/plus/edit-drafts/{draft_id}',None,'PlusEditDraft',False,'读取本人当前有效来源的编辑草稿'),
      ('savePlusEditDraft','PUT','/plus/edit-drafts/{draft_id}','PlusEditSaveRequest','PlusEditDraft',False,'按修订号保存裁切、规格和待核对文字'),
      ('listPlusEditDrafts','GET','/plus/edit-drafts',None,'PlusEditList',False,'按本人范围分页读取有效编辑草稿'),
      ('listPlusRenderStyles','GET','/plus/render-styles',None,'PlusRenderStyleList',False,'读取独立图片制作风格及当前计价可用性'),
      ('createPlusRenderPlan','POST','/plus/edit-drafts/{draft_id}/render-plans','PlusRenderCreateRequest','PlusRenderPlan',False,'冻结编辑修订并整理独立制作清单，付款仍需小程序确认'),
      ('listPlusRenderPlans','GET','/plus/render-plans',None,'PlusRenderPlanList',False,'本人在电脑或原小程序继续独立制作请求'),
      ('getPlusRenderPlan','GET','/plus/render-plans/{request_id}',None,'PlusRenderPlan',False,'读取本人独立制作清单及原渠道订单状态'),
      ('createPlusRenderBatch','POST','/plus/render-batches','PlusBatchCreateRequest','PlusBatch',False,'批量整理2至10件商品的独立清单，单品失败隔离、原渠道逐件付款'),
      ('listPlusRenderBatches','GET','/plus/render-batches',None,'PlusBatchList',False,'本人分页查看批量制作记录'),
      ('getPlusRenderBatch','GET','/plus/render-batches/{batch_id}',None,'PlusBatch',False,'读取批次各件独立规划、订单和交付状态')
    ]
    for _,_,_,_,response,_,_ in operations:
        schemas[response+'Response']=obj({'data':ref(response),'trace_id':{'type':'string'}})
    for doc in [a,m]:doc['components']['schemas'].update(copy.deepcopy(schemas))
    template=next(x for x in e['endpoints'] if x['operation_id']=='getUsageFeedback')
    source=a['paths']['/orders/{order_id}/usage-feedback']['get']
    for op,method,path,request,response,public,summary in operations:
        operation=copy.deepcopy(source)
        params=[{'name':part[1:-1],'in':'path','required':True,'schema':rid} for part in path.split('/') if part.startswith('{')]
        if op in ['listPlusEditDrafts','listPlusRenderPlans','listPlusRenderBatches']:params+=copy.deepcopy(a['paths']['/products']['get'].get('parameters',[]))
        operation.update(operationId=op,summary=summary,description=summary,parameters=params)
        operation['x-requirements']=['P01-F18','P01-F24'];operation['x-design-pages']=['D22'];operation['x-idempotency-required']=False
        if public:operation['security']=[]
        if request:operation['requestBody']={'required':True,'content':{'application/json':{'schema':ref(request)}}}
        operation['responses']['200']['content']['application/json']['schema']=ref(response+'Response')
        a['paths'].setdefault(path,{})[method.lower()]=operation
        row=copy.deepcopy(template);row.update(method=method,path=path,operation_id=op,summary=summary,request_schema=request,response_schema=response,
          auth_policy='public-plus-link-secret' if public else 'product-session-and-resource-ownership',idempotency_required=False,requirements=['P01-F18','P01-F24'],design_pages=['D22'])
        e['endpoints'].append(row)

def extend_plus_data(model):
    for table,fields,invariant in [
      ('plus_links',['id','code_hash','poll_key_hash','state','expires_at','tenant_id','owner_id','identity_id','session_id','allow_render_plans'],'Explicit native confirmation only; 5-minute challenge; hashed secrets; retries preserve original session and expiry.'),
      ('plus_sessions',['id','tenant_id','owner_id','identity_id','token_hash','created_at','expires_at','revoked_at','allow_render_plans'],'One-hour independent read/edit capability; no native payment/refund or identity merge; revocation checked inside each transaction and signed download.'),
      ('plus_edit_drafts',['id','tenant_id','owner_id','order_id','product_id','manifest_id','deliverable_id','revision','data','created_at','updated_at'],'Owned paid current image; separate draft/revision; user-supplied facts remain unverified; deletion physically erases draft and all saved versions.'),
      ('plus_edit_versions',['draft_id','revision','settings_hash','settings','created_at'],'Append-only edit metadata versions, independent of immutable paid delivery; erased with source deletion.'),
      ('plus_render_plans',['id','tenant_id','owner_id','product_id','draft_id','draft_revision','source_order_id','plan_id','input_hash','binding','created_at'],'Immutable independently quoted render plan; exact owned source/edit/tariff frozen, no payment capability in browser; unique natural input and product deletion erasure.'),
      ('plus_render_batches',['id','tenant_id','owner_id','request_key_hash','input_hash','item_count','created_at'],'Hashed owner-scoped intent key; no cached private response; immutable batch contains no shared charge or runtime. Replays recheck permission and redact removed items.'),
      ('plus_render_batch_items',['id','tenant_id','batch_id','position','product_id','request_id','input','failure'],'Per-item savepoint isolates preparation failure; immutable independent render plan and native quote/payment/delivery; product deletion physically erases its batch metadata.')
    ]:model['entities'].append({'table':table,'primary_key':'draft_id' if table=='plus_edit_versions' else 'id','scope':'global' if table=='plus_links' else 'tenant','fields':fields,'invariant':invariant,'implementation_status':'DESIGN_NOT_IMPLEMENTED'})

def plus_catalog(e):
    text='\n\n## Plus主动接续与独立编辑草稿\n\n所有凭证只在内存流转，原生会话批准，电脑会话限制在本人读取/草稿；不复制支付权限。自然键与修订号提供幂等，避免通用缓存复活撤销连接。\n\n| 方法/路径 | operationId | 请求 → 响应 |\n| --- | --- | --- |\n'
    for x in e['endpoints']:
        if 'Plus' in x['operation_id']:text+=f"| {x['method']} {x['path']} | {x['operation_id']} | {x['request_schema'] or '无'} → {x['response_schema']} |\n"
    return text
