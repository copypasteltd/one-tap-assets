#!/usr/bin/python3
"""Operator-run synthetic protocol probe with real Linux OS boundaries.
Does not create DB admissions, orders, sales, model calls or payment requests.
"""
import copy
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import pwd
import selectors
import signal
import subprocess
import time
import uuid

ROOT = Path('/opt/one-tap-assets/app')
CFG = Path('/root/cfg/one-tap-assets')
STATE = Path('/var/lib/one-tap-assets-agent-probe')
UNIT = 'one-tap-assets-native-probe.service'
SOCKET = '/run/one-tap-assets-agent/probe.sock'
CLIENT = ROOT / 'deploy/linux/bin/agent-launcher'
ROWS = []
ACCOUNT = pwd.getpwnam('ypcc')
CREATED = []


def run(args, okay=(0,), timeout=20):
    value = subprocess.run(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=timeout)
    assert value.returncode in okay, (args[0], value.returncode, value.stderr.decode(errors='replace')[:2000])
    return value


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def owned_file(path, text, mode=0o600):
    path.write_text(text)
    os.chmod(path, mode)
    os.chown(path, ACCOUNT.pw_uid, ACCOUNT.pw_gid)


def worker_args(action, path):
    return ['/usr/sbin/runuser', '-u', 'ypcc', '--', '/usr/bin/env', 'YPCC_NATIVE_SOCKET=' + SOCKET,
            '/usr/bin/python3', str(CLIENT), action, '--manifest', str(path)]


def fixture(binary):
    suffix = uuid.uuid4().hex
    instance, role = 'native_probe_instance_' + suffix, 'native_probe_run_' + suffix
    control = ROOT / 'runtime/agent-control' / instance
    root = ROOT / 'runtime/agent-instances' / instance / role
    for path in (control, root, root / 'home', root / 'work', root / 'tmp', root / 'home/skills', root / 'home/skills/probe'):
        path.mkdir(parents=True, exist_ok=True)
        os.chown(path, ACCOUNT.pw_uid, ACCOUNT.pw_gid)
        os.chmod(path, 0o750)
    owned_file(root / 'home/config.toml', '# Synthetic OS probe; no model call\n', 0o400)
    owned_file(root / 'work/input.json', '{"synthetic":true}', 0o400)
    owned_file(root / 'home/skills/probe/SKILL.md', '# Synthetic OS probe\n', 0o400)
    deadline = dt.datetime.now(dt.timezone.utc) + dt.timedelta(seconds=90)
    milliseconds = int(deadline.timestamp() * 1000)
    value = {'version': 'YPCC-NATIVE-LAUNCH-1', 'nonce': uuid.uuid4().hex, 'instance_id': instance, 'run_id': role,
             'executable': str(binary), 'executable_sha256': sha(binary), 'args': ['app-server', '--listen', 'stdio://'],
             'cwd': str(root / 'work'),
             'environment': {'CODEX_HOME': str(root / 'home'), 'HOME': str(root / 'home'), 'USERPROFILE': str(root / 'home'),
                             'TMP': str(root / 'tmp'), 'TEMP': str(root / 'tmp'), 'TMPDIR': str(root / 'tmp'), 'YPCC_ROLE_CAPABILITY': 'synthetic-native-probe-not-a-real-capability',
                             'YPCC_TOOL_CAPABILITY': 'synthetic-native-probe-not-a-real-capability',
                             'YPCC_TOOL_ENDPOINT': 'http://127.0.0.1:38410', 'YPCC_ROLE_DEADLINE_MS': str(milliseconds)},
             'read_only_paths': [str(root / 'home/skills'), str(root / 'home/config.toml'), str(root / 'work/input.json'),
                                 SETTINGS['bridge'], SETTINGS['node'], str(binary), str(ROOT / 'package.json')],
             'writable_paths': [str(root / part) for part in ('home', 'work', 'tmp')],
             'virtualization': 'FORBIDDEN', 'shell_tools': 'DISABLED', 'network_origins': ['http://127.0.0.1:38410'],
             'deadline_at': deadline.isoformat(), 'launch_receipt_path': str(control / 'launch-receipt.json'),
             'cleanup_receipt_path': str(control / 'native-cleanup.json')}
    path = control / 'launch.json'
    owned_file(path, json.dumps(value))
    CREATED.append((value, control, root))
    return value, path


def start(binary):
    value, path = fixture(binary)
    client = subprocess.Popen(worker_args('run', path), stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                              stderr=subprocess.PIPE, start_new_session=True)
    selector = selectors.DefaultSelector()
    selector.register(client.stdout, selectors.EVENT_READ)
    assert selector.select(45), 'Native probe startup timed out'
    line = client.stdout.readline()
    selector.close()
    if not line:
        detail = run(['/usr/bin/journalctl', '-u', UNIT, '--no-pager', '-n', '12']).stdout.decode()
        error = client.stderr.read().decode(errors='replace')[:2000]
        raise AssertionError('Native probe did not start: ' + detail + '\n' + error)
    observed = json.loads(line)
    receipt = json.loads(Path(value['launch_receipt_path']).read_text())
    assert receipt['isolation'] == 'NATIVE_RESTRICTED_IDENTITY' and receipt['nonce'] == value['nonce']
    return client, value, observed, receipt


def released(value, observed):
    until = time.monotonic() + 12
    receipt = Path(value['cleanup_receipt_path'])
    while not receipt.exists() and time.monotonic() < until:
        time.sleep(.1)
    assert receipt.is_file(), 'Native cleanup receipt missing'
    clean = json.loads(receipt.read_text())
    assert all(clean.get(key) is True for key in ('no_active_processes', 'credentials_removed', 'temporary_files_removed'))
    assert not Path('/proc', str(observed['child_pid'])).exists(), 'Descendant survived cgroup cleanup'
    assert not any(Path(path).exists() for path in value['writable_paths']), 'Temporary role directory retained'
    assert json.loads(receipt.with_name('launch.json').read_text())['environment'] == {}, 'Capability retained'
    return clean


def main():
    global SETTINGS
    assert os.geteuid() == 0
    SETTINGS = json.loads((CFG / 'native-launcher.json').read_text())
    binary = ROOT / 'runtime/tools/native-probe/role-probe'
    binary.parent.mkdir(parents=True, exist_ok=True)
    run(['/usr/bin/gcc', '-O2', '-Wall', '-Wextra', '-Werror', '-o', str(binary), str(ROOT / 'tests/fixtures/native-agent-probe.c')])
    os.chmod(binary, 0o755)
    SETTINGS.update(executable=str(binary), executable_sha256=sha(binary), state_root=str(STATE), socket=SOCKET, uid_min=63000, uid_max=63999)
    config = CFG / 'native-probe.json'
    config.write_text(json.dumps(SETTINGS))
    os.chmod(config, 0o600)
    neighbor = ROOT / 'runtime/agent-instances/native-probe-neighbor'
    neighbor.mkdir(exist_ok=True, parents=True)
    owned_file(neighbor / 'private.txt', 'synthetic other customer fixture only', 0o600)
    run(['/usr/bin/systemctl', 'stop', UNIT], okay=(0, 1, 5))
    Path(SOCKET).unlink(missing_ok=True)
    run(['/usr/bin/systemd-run', '--quiet', '--unit=' + UNIT, '--property=KillMode=control-group',
         '/usr/bin/python3', '-I', '-B', '/opt/one-tap-assets/native-agent/agent-broker.py', '--config', str(config)])
    until = time.monotonic() + 5
    while not Path(SOCKET).exists() and time.monotonic() < until:
        time.sleep(.1)
    try:
        client, value, observed, receipt = start(binary)
        checks = [key for key in observed if key not in ('uid', 'child_pid')]
        for key in checks:
            assert observed[key] == 1, (key, observed)
            ROWS.append({'id': key, 'status': 'PASS'})
        unit = receipt['process_ref'].split(':', 1)[0]
        environment = run(['/usr/bin/systemctl', 'show', unit, '--property=Environment']).stdout.decode()
        assert 'synthetic-native-probe-not-a-real-capability' not in environment and 'YPCC_ROLE_CAPABILITY' not in environment
        ROWS.append({'id': 'capability_absent_from_unit_properties', 'status': 'PASS'})
        request = Path(value['cleanup_receipt_path']).with_name('release-request.json')
        owned_file(request, json.dumps(dict(value, environment={})))
        run(worker_args('release', request))
        released(value, observed)
        client.wait(timeout=5)
        run(worker_args('release', request))
        ROWS.append({'id': 'detached_release_tree_cleanup_and_idempotency', 'status': 'PASS'})

        client2, value2, observed2, _ = start(binary)
        os.killpg(client2.pid, signal.SIGKILL)
        client2.wait(timeout=5)
        released(value2, observed2)
        ROWS.append({'id': 'worker_stdio_disconnect_releases_role', 'status': 'PASS'})

        client3, value3, observed3, _ = start(binary)
        run(['/usr/bin/systemctl', 'restart', UNIT])
        released(value3, observed3)
        client3.wait(timeout=5)
        ROWS.append({'id': 'broker_restart_reaps_durable_owned_roles', 'status': 'PASS'})

        bad, bad_path = fixture(binary)
        bad['network_origins'] = ['http://192.168.31.20:38480']
        owned_file(bad_path, json.dumps(bad))
        result = run(worker_args('run', bad_path), okay=(1,))
        assert not Path(bad['launch_receipt_path']).exists()
        ROWS.append({'id': 'off_loopback_manifest_rejected', 'status': 'PASS'})
        result = run(['/usr/bin/env', 'YPCC_NATIVE_SOCKET=' + SOCKET, '/usr/bin/python3', str(CLIENT), 'run', '--manifest', str(bad_path)], okay=(1,))
        ROWS.append({'id': 'untrusted_socket_peer_rejected', 'status': 'PASS'})
        report = {'checked_at': dt.datetime.now(dt.timezone.utc).isoformat(),
                  'scope': 'ACTUAL_LINUX_OS_BOUNDARIES_WITH_SYNTHETIC_MODEL_EXECUTABLE',
                  'host': '192.168.31.20', 'virtualization_used': False, 'rows': ROWS,
                  'broker_sha256': sha('/opt/one-tap-assets/native-agent/agent-broker.py'), 'launcher_sha256': sha(CLIENT),
                  'real_model_called': False, 'real_skill_admitted': False, 'production_admitted': False}
        output = ROOT / 'docs/verification/native-agent-linux-2026-11-06.json'
        output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
        print(json.dumps(report, ensure_ascii=False))
    finally:
        run(['/usr/bin/systemctl', 'stop', UNIT], okay=(0, 1, 5))
        # Keep root-only durable probe journals/receipts for operator diagnosis.
        # Business DB and production admission states are never written.


if __name__ == '__main__':
    main()
