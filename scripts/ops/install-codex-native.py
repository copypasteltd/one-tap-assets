#!/usr/bin/python3
"""Install only the pinned official Linux ELF. No containers, personal auth,
model calls, feature enablement or automatic upgrades. Run native installer first.
"""
import base64, datetime, hashlib, io, json, os, platform, shutil, tarfile, urllib.request, urllib.parse
from pathlib import Path
import subprocess
assert os.geteuid()==0 and platform.machine()=='x86_64'
root=Path('/opt/one-tap-assets/app')
cfg=Path('/root/cfg/one-tap-assets')
def fetch(url,limit):
    with urllib.request.urlopen(url,timeout=40) as response:
        data=response.read(limit+1)
        assert len(data)<=limit
        return data
version='0.166.0'
meta=json.loads(fetch('https://registry.npmjs.org/@openai%2fcodex/'+version,1000000))
assert meta['version']==version
package='@openai/codex-linux-x64'
specifier=meta.get('optionalDependencies',{}).get(package)
if specifier:
    if specifier.startswith('npm:'): package,specifier=specifier[4:].rsplit('@',1)
    assert package.startswith('@openai/codex')
    meta=json.loads(fetch('https://registry.npmjs.org/'+urllib.parse.quote(package,safe='')+'/'+urllib.parse.quote(specifier,safe=''),1000000))
dist=meta['dist'];url=dist['tarball'];assert url.startswith('https://registry.npmjs.org/')
data=fetch(url,200000000)
kind,value=dist['integrity'].split('-',1)
assert kind=='sha512' and base64.b64encode(hashlib.sha512(data).digest()).decode()==value
with tarfile.open(fileobj=io.BytesIO(data),mode='r:gz') as archive:
    entries=[entry for entry in archive.getmembers() if entry.isfile() and (entry.name.endswith('/codex/codex') or entry.name.endswith('/bin/codex')) and ('linux' in entry.name or 'x86_64' in entry.name)]
    assert len(entries)==1, [entry.name for entry in archive.getmembers()][:25]
    binary=archive.extractfile(entries[0]).read();assert binary[:4]==b'\x7fELF'
target=root/'runtime/tools/codex'/version/'codex'
assert hashlib.sha256(binary).hexdigest()=='b8a11fedf24b2dfb59a70c9e52b030f9a508dcd49cd2dd0d41956f4c785156b8'
target.parent.mkdir(parents=True,exist_ok=True)
for parent in (root/'runtime/tools',root/'runtime/tools/codex',target.parent):os.chmod(parent,0o755)
assert not target.is_symlink()
if target.exists():assert target.read_bytes()==binary
else:target.write_bytes(binary)
os.chmod(target,0o755)
pin=hashlib.sha256(binary).hexdigest()
checkhome=root/'runtime/tmp/codex-install-check'
checkhome.mkdir(parents=True,exist_ok=True)
output=subprocess.run([str(target),'--version'],env={'HOME':str(checkhome),'CODEX_HOME':str(checkhome),'PATH':'/usr/bin:/bin'},check=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=10).stdout.decode().strip()
settings=json.loads((cfg/'native-launcher.json').read_text())
snapshot=cfg/'config-snapshots'/('codex-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ'))
snapshot.mkdir(mode=0o700,parents=True)
for filename in ['app.env','native-launcher.json']:
    shutil.copy2(cfg/filename,snapshot/filename)
settings.update(executable=str(target),executable_sha256=pin)
(cfg/'native-launcher.json').write_text(json.dumps(settings,indent=2)+'\n')
updates={'CODEX_BINARY_PATH':str(target.relative_to(root)),'CODEX_BUILD_SHA256':pin,'CODEX_PROTOCOL_VERSION':'codex-app-server-v2-0.166.0'}
env=cfg/'app.env';lines=[line for line in env.read_text().splitlines() if line.split('=',1)[0] not in updates]
lines +=[key+'='+value for key,value in updates.items()]
env.write_text('\n'.join(lines)+'\n');os.chmod(env,0o600)
report={'checked_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'version':version,'reported_version':output,'executable':str(target),'sha256':pin,
'source':url,'npm_integrity_verified':True,'model_called':False,'production_admitted':False}
(cfg/'codex-install.json').write_text(json.dumps(report,indent=2)+'\n');os.chmod(cfg/'codex-install.json',0o600)
print(json.dumps(report))
