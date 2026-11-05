#!/usr/bin/python3
"""Install/reapply only this project's native Linux Agent adapter as root.
Never enables generation, payments, Codex admission or sales.
"""
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import pwd
import shutil
import subprocess

PROJECT = Path('/opt/one-tap-assets/app')
CFG = Path('/root/cfg/one-tap-assets')
NATIVE = Path('/opt/one-tap-assets/native-agent')


def run(args, timeout=60):
    return subprocess.run(args, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                          timeout=timeout, env={'PATH': '/usr/sbin:/usr/bin:/sbin:/bin', 'DEBIAN_FRONTEND': 'noninteractive', 'LANG': 'C.UTF-8'})


def sha(path):
    value = hashlib.sha256()
    with open(path, 'rb') as reader:
        for chunk in iter(lambda: reader.read(1024 * 1024), b''):
            value.update(chunk)
    return value.hexdigest()


def install():
    assert os.geteuid() == 0 and PROJECT.is_dir() and (CFG / 'app.env').is_file()
    assert PROJECT.resolve() == PROJECT and CFG.resolve() == CFG
    if not shutil.which('setfacl'):
        try:
            run(['/usr/bin/apt-get', 'install', '-y', '-qq', 'acl'], timeout=180)
        except subprocess.CalledProcessError:
            try:
                run(['/usr/bin/apt-get', 'update', '-qq'], timeout=180)
                run(['/usr/bin/apt-get', 'install', '-y', '-qq', 'acl'], timeout=180)
            except subprocess.CalledProcessError as error:
                raise RuntimeError('Native ACL dependency installation failed: ' + error.stderr.decode(errors='replace')[:1500]) from None
    for name in ('systemd-run', 'apparmor_parser', 'iptables', 'ip6tables', 'setfacl', 'gcc'):
        assert shutil.which(name), 'Missing native dependency: ' + name
    snapshot = CFG / 'config-snapshots' / ('native-agent-' + dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ'))
    snapshot.mkdir(mode=0o700, parents=True)
    NATIVE.mkdir(mode=0o755, exist_ok=True)
    for relative in ('deploy', 'deploy/linux', 'deploy/linux/bin', 'deploy/linux/systemd'):
        directory = PROJECT / relative
        assert directory.resolve() == directory
        os.chmod(directory, 0o755)
    for name in ('agent-broker.py', 'agent-env-exec.c'):
        source = PROJECT / 'deploy/linux/bin' / name
        target = NATIVE / name
        if target.exists():
            shutil.copy2(target, snapshot / name)
        shutil.copyfile(source, target)
        os.chmod(target, 0o644)
        os.chown(target, 0, 0)
    run(['/usr/bin/gcc', '-O2', '-Wall', '-Wextra', '-Werror', '-D_FORTIFY_SOURCE=2', '-fstack-protector-strong',
         '-fPIE', '-pie', '-Wl,-z,relro,-z,now', '-o', str(NATIVE / 'agent-env-exec'), str(NATIVE / 'agent-env-exec.c')])
    os.chmod(NATIVE / 'agent-env-exec', 0o755)
    launcher = PROJECT / 'deploy/linux/bin/agent-launcher'
    # Preserve the repository template separately for idempotent local reapply.
    template_path = NATIVE / 'agent-launcher.template'
    template = launcher.read_text()
    if 'EXPECTED_BUILD = None' in template:
        template_path.write_text(template)
        os.chmod(template_path, 0o644)
    else:
        assert template_path.is_file(), 'Reinstall the source launcher template first'
        template = template_path.read_text()
    build_pin = {'broker_sha256': sha(NATIVE / 'agent-broker.py'), 'env_exec_sha256': sha(NATIVE / 'agent-env-exec')}
    launcher.write_text(template.replace('EXPECTED_BUILD = None', 'EXPECTED_BUILD = ' + repr(build_pin), 1))
    os.chown(launcher, 0, 0)
    os.chmod(launcher, 0o755)
    unit_name = 'one-tap-assets-agent-broker.service'
    unit = Path('/etc/systemd/system') / unit_name
    if unit.exists():
        shutil.copy2(unit, snapshot / unit_name)
    shutil.copyfile(PROJECT / 'deploy/linux/systemd' / unit_name, unit)
    os.chmod(unit, 0o644)
    account = pwd.getpwnam('ypcc')
    cfg_path = CFG / 'native-launcher.json'
    existing = {}
    if cfg_path.exists():
        existing = json.loads(cfg_path.read_text())
        shutil.copy2(cfg_path, snapshot / cfg_path.name)
    node = str(Path('/opt/one-tap-assets/tools/node/bin/node').resolve())
    bridge = str(PROJECT / 'runtime/build/worker/tool-gateway/mcp-main.js')
    settings = {'version': 'YPCC-LINUX-NATIVE-1', 'project_root': str(PROJECT), 'runtime_root': str(PROJECT / 'runtime'),
                'worker_uid': account.pw_uid, 'worker_gid': account.pw_gid,
                'gateway_origin': 'http://127.0.0.1:38410', 'node': node, 'node_sha256': sha(node),
                'bridge': bridge, 'bridge_sha256': sha(bridge), 'env_exec': str(NATIVE / 'agent-env-exec'),
                'uid_min': 62000, 'uid_max': 62999, 'max_concurrent': 8, 'max_role_seconds': 3600,
                'memory_max_bytes': 2147483648, 'executable': existing.get('executable', ''),
                'executable_sha256': existing.get('executable_sha256', '')}
    # The API's Node is outside the application tree on this captured server.
    # Broker allows exactly this root-pinned helper path; model files stay local.
    fd = os.open(cfg_path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, 'w') as writer:
        json.dump(settings, writer, ensure_ascii=False, indent=2)
        writer.write('\n')
    os.chmod(cfg_path, 0o600)
    env_path = CFG / 'app.env'
    shutil.copy2(env_path, snapshot / env_path.name)
    lines = env_path.read_text().splitlines()
    updates = {'CODEX_GATEWAY_ORIGIN': 'http://127.0.0.1:38410', 'CODEX_ISOLATION_LAUNCHER': './deploy/linux/bin/agent-launcher'}
    new_lines = [line for line in lines if line.split('=', 1)[0] not in updates]
    new_lines += [key + '=' + value for key, value in updates.items()]
    env_path.write_text('\n'.join(new_lines) + '\n')
    os.chmod(env_path, 0o600)
    handoff = {'gateway_origin': settings['gateway_origin'], 'launcher': str(launcher), 'launcher_sha256': sha(launcher),
               'native_build': build_pin,
               'broker_config': str(cfg_path), 'paid_services_enabled_by_installer': False,
               'runtime_configured_not_admitted': bool(settings['executable']),
               'pending': ([] if settings['executable'] else ['Pinned Codex ELF and protocol']) + ['Service model/key and rate/budget', 'Model registry and genuine admission',
                           'Real Skill discovery, production, review and release evidence']}
    (CFG / 'native-agent-handoff.json').write_text(json.dumps(handoff, ensure_ascii=False, indent=2) + '\n')
    os.chmod(CFG / 'native-agent-handoff.json', 0o600)
    run(['/usr/bin/systemd-analyze', 'verify', str(unit)])
    run(['/usr/bin/systemctl', 'daemon-reload'])
    run(['/usr/bin/systemctl', 'enable', unit_name])
    run(['/usr/bin/systemctl', 'restart', unit_name])
    print(json.dumps({'installed': True, 'snapshot': str(snapshot), 'launcher_sha256': sha(launcher),
                      'broker_active': run(['/usr/bin/systemctl', 'is-active', unit_name]).stdout.decode().strip(),
                      'real_model_admitted': False}))


if __name__ == '__main__':
    install()
