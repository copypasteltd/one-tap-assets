"""Two native identities, mutual confirmation, revocable project sharing."""
import copy

def extend_account_binding_contract(a,m,e):
    ref=lambda name:{'$ref':'#/components/schemas/'+name}
    obj=lambda props,required=None:{'type':'object','properties':props,'required':list(props) if required is None else required,'additionalProperties':False}
    rid={'type':'string','pattern':'^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$'}
    date={'type':'string','format':'date-time','maxLength':40}
    code={'type':'string','pattern':'^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$'}
    request=obj({'request_id':rid,'state':{'type':'string','enum':['PENDING','CLAIMED','BOUND','CANCELLED','REJECTED','EXPIRED']},
      'role':{'type':'string','enum':['ORIGIN','PEER','CANDIDATE']},'origin_platform':ref('Platform'),'peer_platform':ref('Platform'),
      'created_at':date,'expires_at':date,'user_code':code,'verification_code':code,'binding_id':rid},
      ['request_id','state','role','origin_platform','created_at','expires_at'])
    binding=obj({'binding_id':rid,'peer_platform':ref('Platform'),'state':{'type':'string','enum':['ACTIVE','REVOKED']},
      'created_at':date,'revoked_at':{'anyOf':[date,{'type':'null'}]},'access':{'const':'PROJECTS_DRAFTS_AND_EXPLICIT_PLUS_PLANS'}})
    schemas={'AccountBindingStartRequest':obj({}),'AccountBindingCodeRequest':obj({'user_code':code}),
      'AccountBindingDecisionRequest':obj({'decision':{'type':'string','enum':['CONFIRM','CANCEL','REJECT']},'verification_code':code},['decision']),
      'AccountBindingRequest':request,'AccountBinding':binding,
      'AccountBindingRequestList':obj({'items':{'type':'array','maxItems':5,'items':ref('AccountBindingRequest')},'next_cursor':{'type':'null'}}),
      'AccountBindingList':obj({'items':{'type':'array','maxItems':20,'items':ref('AccountBinding')},'next_cursor':{'type':'null'}})}
    operations=[
      ('createAccountBindingRequest','POST','/account-bindings/requests','AccountBindingStartRequest','AccountBindingRequest','原小程序发起五分钟双端绑定'),
      ('inspectAccountBindingCode','POST','/account-bindings/inspect','AccountBindingCodeRequest','AccountBindingRequest','另一端查看邀请；不接触作品或授予权限'),
      ('claimAccountBindingRequest','POST','/account-bindings/claim','AccountBindingCodeRequest','AccountBindingRequest','另一端主动证明控制权并等待发起端核对确认码'),
      ('listAccountBindingRequests','GET','/account-bindings/requests',None,'AccountBindingRequestList','恢复本人尚未结束的绑定请求，最多五条'),
      ('getAccountBindingRequest','GET','/account-bindings/requests/{request_id}',None,'AccountBindingRequest','本人双方读取绑定进度'),
      ('decideAccountBindingRequest','POST','/account-bindings/requests/{request_id}/decision','AccountBindingDecisionRequest','AccountBindingRequest','发起端核对双方确认码后确认或取消；另一端可撤回'),
      ('listAccountBindings','GET','/account-bindings',None,'AccountBindingList','读取本人当前绑定及最近二十条解除记录'),
      ('revokeAccountBinding','DELETE','/account-bindings/{binding_id}',None,'AccountBinding','任何一端解除绑定并撤销派生连接及下载权限'),
      ('createBoundProjectSession','POST','/account-bindings/{binding_id}/project-session',None,'PlusBrowserSession','本机短期浏览已绑定端项目；原渠道资金权限不转移')]
    for _,_,_,_,response,_ in operations:
        schemas[response+'Response']=obj({'data':ref(response),'trace_id':{'type':'string'}})
    for doc in [a,m]:
        doc['components']['schemas'].update(copy.deepcopy(schemas))
        for name in ['PlusLinkDecisionRequest','PlusLinkApproval','PlusSessionInfo']:
            doc['components']['schemas'][name]['properties']['account_binding_id']=copy.deepcopy(rid)
        doc['components']['schemas']['PlusLinkApproval']['properties']['source_platform']=ref('Platform')
        doc['components']['schemas']['PlusSessionList']['properties']['items']['maxItems']=10
    template=next(row for row in e['endpoints'] if row['operation_id']=='getPlusSession')
    source=a['paths']['/plus/session']['get']
    for oid,method,path,body,response,summary in operations:
        op=copy.deepcopy(source)
        op.update(operationId=oid,summary=summary,description=summary,parameters=[{'name':part[1:-1],'in':'path','required':True,'schema':copy.deepcopy(rid)} for part in path.split('/') if part.startswith('{')])
        op['x-requirements']=['P01-F24'];op['x-design-pages']=['D22'];op['x-idempotency-required']=False
        if body:op['requestBody']={'required':True,'content':{'application/json':{'schema':ref(body)}}}
        op['responses']['200']['content']['application/json']['schema']=ref(response+'Response')
        a['paths'].setdefault(path,{})[method.lower()]=op
        row=copy.deepcopy(template);row.update(method=method,path=path,operation_id=oid,summary=summary,request_schema=body,response_schema=response,
          auth_policy='native-session-and-mutual-binding-control',idempotency_required=False,requirements=['P01-F24'],design_pages=['D22'])
        e['endpoints'].append(row)

def extend_account_binding_data(model):
    for table,fields,invariant in [
      ('account_binding_requests',['id','code_hash','origin_identity_id','peer_identity_id','state','binding_id','created_at','expires_at'],
       'Five-minute frozen deadline; origin native proof, peer native claim and origin verification-code confirmation; no rights before BOUND; peer and terminal outcome never replaced.'),
      ('account_bindings',['id','alipay_identity_id','douyin_identity_id','created_at','revoked_at'],
       'One active counterpart per identity; mutual native proof; projects and drafts only; original orders, paid rights and refunds remain in original tenant/channel. Revocation is irreversible and invalidates derived grants.')]:
        model['entities'].append({'table':table,'primary_key':'id','scope':'explicit-two-native-identities','fields':fields,'invariant':invariant,'implementation_status':'DESIGN_NOT_IMPLEMENTED'})
    for row in model['entities']:
        if row['table'] in ['plus_links','plus_sessions']:row['fields']+=['account_binding_id','approved_by_identity_id']
