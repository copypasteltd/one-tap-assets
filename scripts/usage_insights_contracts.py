"""Compatible optional feedback and aggregate measurement contract extension. No I/O."""
import copy

def extend_usage_insights_contract(a,m,e,me):
    schemas={}; integer={'type':'integer','minimum':0,'maximum':2147483647};micro={'type':'integer','minimum':0,'maximum':9007199254740991}
    timestamp=copy.deepcopy(a['components']['schemas']['Analysis']['properties']['updated_at'])
    def obj(properties):return {'type':'object','properties':properties,'required':list(properties),'additionalProperties':False}
    def nullable(value):return {'anyOf':[copy.deepcopy(value),{'type':'null'}]}
    def ref(name):return {'$ref':'#/components/schemas/'+name}
    schemas['UsageChoice']={'type':'string','enum':['PLANNED_USE','USED','NEEDS_ADJUSTMENT']}
    schemas['UsageFeedback']=obj({'order_id':copy.deepcopy(a['components']['schemas']['Analysis']['properties']['analysis_id']),
        'choice':nullable(ref('UsageChoice')),'revision':integer,'updated_at':nullable(timestamp)})
    schemas['UsageFeedbackRequest']=obj({'choice':nullable(ref('UsageChoice')),'expected_revision':integer})
    schemas['TrafficGroup']={'type':'string','enum':['UNCLASSIFIED','INTERNAL_TEST','EXTERNAL']}
    schemas['TrafficClassificationRequest']=obj({'traffic_group':ref('TrafficGroup')})
    schemas['TrafficClassification']=obj({'traffic_group':ref('TrafficGroup'),'updated_at':nullable(timestamp)})
    schemas['ProductInsights']=obj({'window_start':timestamp,'window_end':timestamp,'traffic_group':{'type':'string','enum':['ALL','UNCLASSIFIED','INTERNAL_TEST','EXTERNAL']},
        'recognition':obj({**{k:integer for k in ['jobs','ready_jobs','blocked_jobs','failed_jobs','attempts','machine_profiles','profiles_with_observed_fields','observed_fields','ocr_fields','hypothesis_fields','unknown_fields','conflicted_fields']},'evidenced_field_share':nullable({'type':'number','minimum':0,'maximum':1}),'accuracy':{'type':'null'}}),
        'funnel':obj({**{k:integer for k in ['selected_product_presets','paid_orders','paid_buyers','first_deliveries']},'recommendation_impressions':{'type':'null'},'recommendation_clicks':{'type':'null'},'automatic_success_ratio':{'type':'null'}}),
        'album':obj({k:integer for k in ['saved_files','saved_orders','unwindowed_receipts']}),
        'feedback':obj({k:integer for k in ['planned_use','used','needs_adjustment','withdrawn']}),
        'community':obj({k:integer for k in ['published_versions','effective_reuses']}),
        'costs':obj({'currency':{'const':'CNY'},'order_settled_micro':micro,'platform_settled_micro':micro,'platform_unresolved_reservations':integer,'platform_unclassified_reservations':integer,'review_support_micro':{'type':'null'},'complete_cost_micro':{'type':'null'}})})
    for name in list(schemas):
        if name in ['UsageFeedback','TrafficClassification','ProductInsights']:
            schemas[name+'Response']=obj({'data':ref(name),'trace_id':{'type':'string'}})
    for doc in [a,m]:doc['components']['schemas'].update(copy.deepcopy(schemas))
    def business(op,method,path,request,response,summary):
        template=copy.deepcopy(a['paths']['/orders/{order_id}/deliverables']['get'])
        template.update(operationId=op,summary=summary,description=summary)
        template['responses']['200']['content']['application/json']['schema']=ref(response+'Response')
        template['x-requirements']=['P01-F17','P01-F23'];template['x-design-pages']=['D11'];template['x-idempotency-required']=False
        if request:template['requestBody']={'required':True,'content':{'application/json':{'schema':ref(request)}}}
        a['paths'].setdefault(path,{})[method.lower()]=template
        row=copy.deepcopy(next(x for x in e['endpoints'] if x['operation_id']=='getDeliverables'))
        row.update(method=method,path=path,operation_id=op,summary=summary,request_schema=request,response_schema=response,requirements=['P01-F17','P01-F23'],design_pages=['D11'])
        e['endpoints'].append(row)
    business('getUsageFeedback','GET','/orders/{order_id}/usage-feedback',None,'UsageFeedback','读取本人订单的自愿使用反馈')
    business('setUsageFeedback','PUT','/orders/{order_id}/usage-feedback','UsageFeedbackRequest','UsageFeedback','按原修订号更新或撤回自愿反馈；不影响保存和交付')
    def management(op,method,path,request,response,permission,summary,parameters):
        template=copy.deepcopy(m['paths']['/metrics/summary']['get'])
        template.update(operationId=op,summary=summary,parameters=parameters)
        template['x-required-permission']=permission;template['x-idempotency-required']=method!='GET'
        template['responses']['200']['content']['application/json']['schema']=ref(response+'Response')
        if request:template['requestBody']={'required':True,'content':{'application/json':{'schema':ref(request)}}}
        m['paths'].setdefault(path,{})[method.lower()]=template
        row=copy.deepcopy(next(x for x in me['endpoints'] if x['operation_id']=='readOperationalSummary'))
        row.update(method=method,path=path,operation_id=op,summary=summary,permission=permission,request_schema=request,response_schema=response)
        me['endpoints'].append(row)
    window=copy.deepcopy(m['paths']['/metrics/summary']['get']['parameters'][2:])
    management('readProductInsights','GET','/metrics/product-insights',None,'ProductInsights','metrics:read','读取分群识别、保存、反馈、社区复用与已入账成本',window+[{'name':'traffic_group','in':'query','required':False,'schema':{'type':'string','enum':['ALL','UNCLASSIFIED','INTERNAL_TEST','EXTERNAL']}}])
    ids=[{'name':name,'in':'path','required':True,'schema':copy.deepcopy(a['components']['schemas']['Analysis']['properties']['analysis_id'])} for name in ['tenant_id','user_id']]
    management('getTrafficClassification','GET','/metrics/accounts/{tenant_id}/{user_id}',None,'TrafficClassification','metrics:classify','读取服务端流量标记',ids)
    management('setTrafficClassification','PUT','/metrics/accounts/{tenant_id}/{user_id}','TrafficClassificationRequest','TrafficClassification','metrics:classify','标记内部测试、外部或未分类流量；不是客户真实性认证',ids+[{'$ref':'#/components/parameters/IdempotencyKey'}])

def usage_insights_catalog(e,me):
    parts=[]
    parts.append('\n\n## 自愿反馈与运营分群增补（兼容扩展）\n\n原目录状态标签保留为设计合同；源码和验证状态见实施文档。PUT 自愿反馈使用 expected_revision 比较更新，无通用幂等缓存，避免撤回后从缓存重放个人选择。\n\n| 方法/路径 | operationId | 请求 → 响应 | 权限 |\n| --- | --- | --- | --- |\n')
    for x in e['endpoints']:
        if x['operation_id'] not in ['getUsageFeedback','setUsageFeedback']:continue
        parts.append(f"| {x['method']} {x['path']} | {x['operation_id']} | {x['request_schema'] or '无'} → {x['response_schema']} | 本人订单 |\n")
    for x in me['endpoints'][-3:]:parts.append(f"| {x['method']} {x['path']} | {x['operation_id']} | {x['request_schema'] or '无'} → {x['response_schema']} | {x['permission']} |\n")
    return "".join(parts)

def extend_usage_insights_data(model):
    rows=[
        {"table":"order_usage_feedback","primary_key":"order_id","scope":"tenant","fields":["tenant_id","owner_id","order_id","choice","revision","updated_at"],"ownership_unique_key":["tenant_id","order_id"],"invariant":"Mutable optional feedback; revision compare-and-set; no immutable-manifest writes or cached personal response; owner/deletion gates and revocation erasure."},
        {"table":"metrics_traffic_classifications","primary_key":"owner_id","scope":"tenant","fields":["tenant_id","owner_id","traffic_group","updated_at"],"ownership_unique_key":["tenant_id","owner_id"],"invariant":"Server-managed classification; missing is UNCLASSIFIED; metrics:classify is separate from metrics:read; EXTERNAL is not proof of a verified human customer."}
    ]
    for row in rows:
        if not any(e['table']==row['table'] for e in model['entities']):
            model['entities'].append({**row,'implementation_status':'DESIGN_NOT_IMPLEMENTED'})
    for entity in model['entities']:
        field={'save_receipts':'received_at','platform_cost_accounts':'owner_id'}.get(entity['table'])
        if field and field not in entity['fields']:entity['fields'].append(field)
