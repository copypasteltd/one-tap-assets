import datetime as dt, importlib.util, json, os, selectors, subprocess, time, threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
root=Path('/opt/one-tap-assets/app')
spec=importlib.util.spec_from_file_location('native_probe',root/'scripts/ops/probe-native-agent.py')
p=importlib.util.module_from_spec(spec);spec.loader.exec_module(p)
p.SETTINGS=json.loads(Path('/root/cfg/one-tap-assets/native-launcher.json').read_text())
class Gateway(BaseHTTPRequestHandler):
    def log_message(self,*args):pass
    def do_GET(self):
        okay=self.path=='/v1/internal/p01/agent-tools' and self.headers.get('Authorization')=='Bearer synthetic-native-probe-not-a-real-capability'
        self.send_response(200 if okay else 403);self.send_header('Content-Type','application/json');self.end_headers()
        self.wfile.write(json.dumps({'tools':[{'name':'synthetic_probe_tool','description':'Discovery only; no model turn',
            'inputSchema':{'type':'object','properties':{},'additionalProperties':False}}]} if okay else {}).encode())
    def do_POST(self):
        self.send_response(403);self.end_headers()
gateway=ThreadingHTTPServer(('127.0.0.1',0),Gateway)
threading.Thread(target=gateway.serve_forever,daemon=True).start()
origin='http://127.0.0.1:'+str(gateway.server_port)
p.SOCKET='/run/one-tap-assets-agent/protocol-probe.sock'
p.SETTINGS.update(gateway_origin=origin,state_root='/var/lib/one-tap-assets-agent-protocol-probe',socket=p.SOCKET,uid_min=64000,uid_max=64999)
probe_config=Path('/root/cfg/one-tap-assets/native-protocol-probe.json')
probe_config.write_text(json.dumps(p.SETTINGS));os.chmod(probe_config,0o600)
unit='one-tap-assets-native-protocol-probe.service'
p.run(['/usr/bin/systemctl','stop',unit],okay=(0,1,5))
Path(p.SOCKET).unlink(missing_ok=True)
p.run(['/usr/bin/systemd-run','--quiet','--unit='+unit,'/usr/bin/python3','-I','-B',
    '/opt/one-tap-assets/native-agent/agent-broker.py','--config',str(probe_config)])
until=time.monotonic()+5
while not Path(p.SOCKET).exists() and time.monotonic()<until:time.sleep(.1)
binary=Path(p.SETTINGS['executable'])
manifest,path=p.fixture(binary)
manifest['network_origins']=[origin]
manifest['environment']['YPCC_TOOL_ENDPOINT']=origin
p.owned_file(path,json.dumps(manifest))
home=Path(manifest['environment']['HOME'])
skill=home/'skills/probe/SKILL.md';skill.unlink();skill.parent.rmdir()
for i in range(6):
    directory=home/'skills'/('probe-'+str(i));directory.mkdir();os.chown(directory,p.ACCOUNT.pw_uid,p.ACCOUNT.pw_gid)
    p.owned_file(directory/'SKILL.md','---\nname: probe-'+str(i)+'\ndescription: Synthetic protocol discovery only.\n---\nNo shell or model turn.\n',0o400)
config='''model = "synthetic-no-model-call"
model_provider = "ypcc"
approval_policy = "never"
sandbox_mode = "read-only"
web_search = "disabled"
project_doc_max_bytes = 0
[features]
shell_tool = false
unified_exec = false
multi_agent = false
code_mode = false
[shell_environment_policy]
inherit = "none"
[model_providers.ypcc]
name = "Protocol probe only"
base_url = "http://127.0.0.1:38410/v1/internal/p01/agent-inference"
env_key = "YPCC_ROLE_CAPABILITY"
wire_api = "responses"
requires_openai_auth = false
supports_websockets = false
request_max_retries = 0
stream_max_retries = 0
[mcp_servers.ypcc]
required = true
env_vars = ["YPCC_TOOL_CAPABILITY", "YPCC_TOOL_ENDPOINT", "YPCC_ROLE_DEADLINE_MS"]
'''
config=config.replace('http://127.0.0.1:38410',origin)
config+='command = '+json.dumps(p.SETTINGS['node'])+'\nargs = ['+json.dumps(p.SETTINGS['bridge'])+']\n'
p.owned_file(home/'config.toml',config,0o400)
client=subprocess.Popen(p.worker_args('run',path),stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,bufsize=0)
sequence=0
def rpc(method,params):
    global sequence
    sequence+=1
    client.stdin.write((json.dumps({'jsonrpc':'2.0','id':sequence,'method':method,'params':params})+'\n').encode());client.stdin.flush()
    until=time.monotonic()+45
    while time.monotonic()<until:
        sel=selectors.DefaultSelector();sel.register(client.stdout,selectors.EVENT_READ);ready=sel.select(max(.01,until-time.monotonic()));sel.close()
        assert ready,'Protocol response timeout: '+method
        line=client.stdout.readline()
        assert line,'Codex process ended: '+client.stderr.read().decode(errors='replace')[:1000]
        value=json.loads(line)
        if value.get('id')==sequence:
            assert 'error' not in value, value
            return value['result']
    raise AssertionError('Protocol response timeout')
try:
    init=rpc('initialize',{'clientInfo':{'name':'ypcc-cloud-worker','title':'Protocol probe only','version':'0.1.0'},'capabilities':{'experimentalApi':True}})
    client.stdin.write(b'{"method":"initialized","params":{}}\n');client.stdin.flush()
    skills=rpc('skills/list',{'cwds':[manifest['cwd']],'forceReload':True})
    discovered=[s for entry in skills.get('data',[]) for s in entry.get('skills',[]) if s.get('enabled')]
    thread=rpc('thread/start',{'model':'synthetic-no-model-call','modelProvider':'ypcc','cwd':manifest['cwd'],'approvalPolicy':'never',
      'sandbox':'read-only','ephemeral':True,'serviceName':'ypcc-protocol-probe','developerInstructions':'Synthetic protocol check. Do not run a turn or tools.'})
    status=rpc('mcpServerStatus/list',{'threadId':thread['thread']['id'],'detail':'toolsAndAuthOnly','limit':100})
    report={'checked_at':dt.datetime.now(dt.timezone.utc).isoformat(),'scope':'ACTUAL_CODEX_NATIVE_DISCOVERY_WITHOUT_MODEL_TURN',
      'runtime_sha256':p.sha(binary),'initialized':True,'skill_count':len(discovered),'skill_names':[s.get('name') for s in discovered],
      'skill_errors':[entry.get('errors') for entry in skills.get('data',[])],
      'thread_policy':{key:thread.get(key) for key in ['model','modelProvider','approvalPolicy','cwd','sandbox']},
      'mcp_status_protocol':isinstance(status.get('data'),list),'mcp_servers':status.get('data'),
      'platform_answers':'SYNTHETIC_LOOPBACK_HTTP_GATEWAY','model_called':False,'production_admitted':False}
    assert len(discovered)==6 and all(not entry.get('errors') for entry in skills.get('data',[])),report
    assert thread['model']=='synthetic-no-model-call' and thread['modelProvider']=='ypcc' and thread['approvalPolicy']=='never' and thread['sandbox']['type']=='readOnly',report
    assert len(status.get('data',[]))==1 and status['data'][0].get('name')=='ypcc' and not status['data'][0].get('toolsError') \
        and any(tool.get('name')=='synthetic_probe_tool' for tool in status['data'][0].get('tools',{}).values()),report
    print(json.dumps(report))
    (root/'docs/verification/codex-native-protocol-2026-11-06.json').write_text(json.dumps(report,indent=2)+'\n')
finally:
    client.stdin.close()
    try:client.wait(timeout=10)
    except subprocess.TimeoutExpired:client.kill();client.wait(timeout=3)
    # Synthetic probe only. Keep startup diagnostics private for operator repair.
    diagnostics=client.stderr.read().decode(errors='replace')
    diagnostic_path=Path('/root/cfg/one-tap-assets/native-protocol-probe.log')
    diagnostic_path.write_text(diagnostics);os.chmod(diagnostic_path,0o600)
    request=Path(manifest['cleanup_receipt_path']).with_name('release-request.json')
    p.owned_file(request,json.dumps(dict(manifest,environment={})))
    result=p.run(p.worker_args('release',request))
    p.run(['/usr/bin/systemctl','stop',unit],okay=(0,1,5))
    gateway.shutdown();gateway.server_close()
