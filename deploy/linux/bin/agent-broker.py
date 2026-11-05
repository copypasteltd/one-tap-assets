#!/usr/bin/python3
"""Linux-only native Agent broker: Unix peer credentials, AppArmor, unique UID,
scoped owner firewall, systemd cgroup, durable release receipts. No containers.

Only root installs/runs this file. The application UID can request bounded roles;
it cannot pick root commands, identities, arbitrary writable paths or networks.
"""
import argparse
import base64
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import pwd
import grp
import re
import shutil
import signal
import socket
import stat
import struct
import subprocess
import threading
import time
from urllib.parse import urlsplit

LOCK = threading.RLock()
CONFIG = {}
STATE = None
RUNTIME = None


def check(condition, code):
    if not condition:
        raise ValueError(code)


def command(args, ok=(0,), timeout=12, data=None):
    result = subprocess.run(args, input=data, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                            timeout=timeout, env={'PATH': '/usr/sbin:/usr/bin:/sbin:/bin', 'LANG': 'C.UTF-8'})
    check(result.returncode in ok, 'NATIVE_COMMAND_FAILED:' + Path(args[0]).name)
    return result.stdout.decode(errors='replace').strip()


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode()


def digest(path):
    value = hashlib.sha256()
    with open(path, 'rb') as reader:
        while True:
            chunk = reader.read(1024 * 1024)
            if not chunk:
                break
            value.update(chunk)
    return value.hexdigest()


def checked_read_path(value, exists=True):
    # Node belongs to the captured host tool directory, while every other
    # manifest input is project-local. This exception is root-config pinned.
    root = Path(CONFIG['node']).parent if value == CONFIG['node'] else Path(CONFIG['project_root'])
    return safe_path(value, root, exists=exists)


def safe_path(value, root, exists=True):
    check(isinstance(value, str) and len(value) < 1000 and re.fullmatch(r'/[A-Za-z0-9_./:+-]+', value), 'NATIVE_PATH_INVALID')
    path = Path(value)
    check(path.is_absolute() and '..' not in path.parts and path.is_relative_to(root), 'NATIVE_PATH_OUTSIDE_ROOT')
    current = Path('/')
    for part in path.parts[1:]:
        current /= part
        try:
            check(not stat.S_ISLNK(current.lstat().st_mode), 'NATIVE_PATH_LINK')
        except FileNotFoundError:
            check(not exists, 'NATIVE_PATH_MISSING')
    if exists:
        check(path.resolve() == path and path.exists(), 'NATIVE_PATH_INVALID')
    return path


def atomic_json(path, value, owner=None):
    path = Path(path)
    # Parent has already been validated. O_EXCL prevents following a planted
    # temporary symlink; replace never follows the destination symlink.
    temporary = path.with_name('.' + path.name + '.' + os.urandom(8).hex())
    fd = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    try:
        data = canonical(value)
        with os.fdopen(fd, 'wb') as writer:
            writer.write(data)
            writer.flush()
            os.fsync(writer.fileno())
        if owner:
            os.chown(temporary, *owner)
        os.replace(temporary, path)
        directory = os.open(path.parent, os.O_DIRECTORY)
        try:
            os.fsync(directory)
        finally:
            os.close(directory)
    finally:
        temporary.unlink(missing_ok=True)


def journal_path(record):
    return STATE / (record['key'] + '.json')


def save(record):
    atomic_json(journal_path(record), record)


def read_manifest(path, action):
    path = safe_path(path, RUNTIME / 'agent-control')
    check(path.name in ('launch.json', 'release-request.json'), 'NATIVE_MANIFEST_NAME')
    info = path.stat()
    check(info.st_uid == CONFIG['worker_uid'] and stat.S_ISREG(info.st_mode) and info.st_nlink == 1 and info.st_size <= 131072,
          'NATIVE_MANIFEST_OWNER')
    with open(path, 'rb') as reader:
        value = json.load(reader)
    check(value.get('version') == 'YPCC-NATIVE-LAUNCH-1' and value.get('virtualization') == 'FORBIDDEN'
          and value.get('shell_tools') == 'DISABLED', 'NATIVE_MANIFEST_POLICY')
    for name in ('instance_id', 'run_id', 'nonce'):
        check(isinstance(value.get(name), str) and re.fullmatch(r'[A-Za-z0-9_-]{8,128}', value[name]), 'NATIVE_MANIFEST_ID')
    check(path.parent == RUNTIME / 'agent-control' / value['instance_id'], 'NATIVE_CONTROL_BINDING')
    for name, filename in (('launch_receipt_path', 'launch-receipt.json'), ('cleanup_receipt_path', 'native-cleanup.json')):
        check(value.get(name) == str(path.parent / filename), 'NATIVE_RECEIPT_BINDING')
    clean = dict(value, environment={})
    key = hashlib.sha256((value['instance_id'] + ':' + value['run_id'] + ':' + value['nonce']).encode()).hexdigest()[:32]
    binding = hashlib.sha256(canonical(clean)).hexdigest()
    if action == 'release':
        check(isinstance(value.get('environment'), dict), 'NATIVE_ENV_INVALID')
        return value, key, binding
    root = RUNTIME / 'agent-instances' / value['instance_id'] / value['run_id']
    home, work, temp = (root / name for name in ('home', 'work', 'tmp'))
    # Current adapter uses "tmp"; a different arbitrary root is never accepted.
    check(value.get('cwd') == str(work) and value.get('writable_paths') == list(map(str, (home, work, temp))), 'NATIVE_WRITE_SCOPE')
    for target in (home, work, temp):
        safe_path(str(target), RUNTIME)
    check(CONFIG.get('executable') and value.get('executable') == CONFIG['executable']
          and value.get('executable_sha256') == CONFIG['executable_sha256']
          and value.get('args') == ['app-server', '--listen', 'stdio://'], 'NATIVE_RUNTIME_PIN')
    binary = safe_path(value['executable'], Path(CONFIG['project_root']))
    check(binary.is_file() and digest(binary) == CONFIG['executable_sha256'], 'NATIVE_RUNTIME_HASH')
    with open(binary, 'rb') as reader:
        check(reader.read(4) == b'\x7fELF', 'NATIVE_ELF_REQUIRED')
    check(value.get('network_origins') == [CONFIG['gateway_origin']], 'NATIVE_NETWORK_SCOPE')
    env = value.get('environment')
    allowed_env = {'CODEX_HOME', 'HOME', 'USERPROFILE', 'TMP', 'TEMP', 'TMPDIR', 'YPCC_ROLE_CAPABILITY',
                   'YPCC_TOOL_CAPABILITY', 'YPCC_TOOL_ENDPOINT', 'YPCC_ROLE_DEADLINE_MS', 'LANG',
                   'NODE_EXTRA_CA_CERTS', 'YPCC_TOOL_CA_FILE'}
    check(isinstance(env, dict) and set(env) <= allowed_env
          and all(isinstance(v, str) and len(v) <= 8192 and '\x00' not in v and '\n' not in v for v in env.values()), 'NATIVE_ENV_INVALID')
    check(all(env.get(name) == str(home) for name in ('CODEX_HOME', 'HOME', 'USERPROFILE'))
          and all(env.get(name) == str(temp) for name in ('TMP', 'TEMP'))
          and env.get('YPCC_TOOL_ENDPOINT') == CONFIG['gateway_origin']
          and env.get('YPCC_ROLE_CAPABILITY') == env.get('YPCC_TOOL_CAPABILITY')
          and bool(env.get('YPCC_ROLE_CAPABILITY')), 'NATIVE_ENV_BINDING')
    deadline = dt.datetime.fromisoformat(value['deadline_at'].replace('Z', '+00:00')).timestamp()
    check(time.time() < deadline <= time.time() + CONFIG.get('max_role_seconds', 3600)
          and abs(int(env['YPCC_ROLE_DEADLINE_MS']) / 1000 - deadline) < .01, 'NATIVE_DEADLINE')
    expected_read = {str(home / 'skills'), str(home / 'config.toml'), str(work / 'input.json'),
                     CONFIG['bridge'], CONFIG['node'], str(binary), str(Path(CONFIG['project_root']) / 'package.json')}
    if 'YPCC_TOOL_CA_FILE' in env:
        check(env.get('NODE_EXTRA_CA_CERTS') == env['YPCC_TOOL_CA_FILE'] == str(home / 'gateway-ca.pem'), 'NATIVE_CA_SCOPE')
        expected_read.add(str(home / 'gateway-ca.pem'))
    check(set(value.get('read_only_paths', [])) == expected_read, 'NATIVE_READ_SCOPE')
    for name in expected_read:
        target = checked_read_path(name)
        if target.is_dir():
            for entry in target.rglob('*'):
                check(not entry.is_symlink() and (entry.is_dir() or entry.is_file())
                      and (not entry.is_file() or entry.stat().st_nlink == 1), 'NATIVE_SKILL_LINK')
        else:
            check(target.is_file() and target.stat().st_nlink == 1, 'NATIVE_READ_FILE')
    check(digest(CONFIG['node']) == CONFIG['node_sha256'] and digest(CONFIG['bridge']) == CONFIG['bridge_sha256'], 'NATIVE_TOOL_PIN')
    return value, key, binding


def system_properties(unit):
    result = command(['/usr/bin/systemctl', 'show', unit, '--property=ActiveState,SubState,MainPID,InvocationID,ControlGroup'], ok=(0, 1, 4))
    return dict(line.split('=', 1) for line in result.splitlines() if '=' in line)


def unit_empty(unit):
    properties = system_properties(unit)
    if properties.get('ActiveState') in ('active', 'activating', 'deactivating', 'reloading'):
        return False
    group = properties.get('ControlGroup', '')
    if group:
        check(group.startswith('/system.slice/ypcc-agent-'), 'NATIVE_CGROUP_INVALID')
        root = Path('/sys/fs/cgroup') / group.lstrip('/')
        if root.exists():
            for path in [root / 'cgroup.procs', *root.glob('**/cgroup.procs')]:
                if path.exists() and path.read_text().strip():
                    return False
    return True


def profile_text(record, manifest):
    name = record['profile']
    lines = ['#include <tunables/global>', 'profile ' + name + ' flags=(attach_disconnected,mediate_deleted) {',
             '  #include <abstractions/base>',
             '  network inet stream,', '  network inet6 stream,',
             '  signal (send, receive) peer=' + name + ',', '  signal (receive) peer=unconfined,',
             '  /etc/{hosts,host.conf,nsswitch.conf,resolv.conf,gai.conf,localtime,services} r,',
             '  /usr/share/zoneinfo/** r,', '  /usr/share/locale/** r,',
             '  /etc/ssl/certs/** r,', '  /etc/ssl/openssl.cnf r,', '  owner /proc/*/{cmdline,environ,stat,status,limits,fd/,fd/**} r,',
             '  owner /proc/*/task/** r,', '  /proc/{cpuinfo,meminfo,stat,sys/kernel/osrelease} r,',
             '  /sys/devices/system/cpu/** r,']
    lines += ['  "' + CONFIG['env_exec'] + '" rix,', '  "' + record['environment_path'] + '" r,']
    for path in manifest['writable_paths']:
        lines.extend(['  "' + path + '/" rw,', '  "' + path + '/**" rwk,'])
    for path in manifest['read_only_paths']:
        if Path(path).is_dir():
            lines.extend(['  "' + path + '/" r,', '  "' + path + '/**" mr,',
                          '  deny "' + path + '/**" wk,', '  deny "' + path + '" wk,'])
        else:
            permission = 'rix' if path in (manifest['executable'], CONFIG['node']) else 'mr'
            lines.extend(['  "' + path + '" ' + permission + ',', '  deny "' + path + '" wk,'])
    lines.append('}')
    return '\n'.join(lines) + '\n'


def firewall(record, install):
    uid, tag = str(record['uid']), 'ypcc-agent-' + record['key']
    parsed = urlsplit(CONFIG['gateway_origin'])
    port = str(parsed.port or (443 if parsed.scheme == 'https' else 80))
    # Each rule is owned by one never-concurrent UID and a durable nonce tag.
    # No global policy, forwarding chain or unrelated rule is changed.
    rules = [('/usr/sbin/iptables', ['-m', 'owner', '--uid-owner', uid, '-m', 'comment', '--comment', tag,
                                   '-d', '127.0.0.1/32', '-p', 'tcp', '--dport', port, '-j', 'ACCEPT']),
             ('/usr/sbin/iptables', ['-m', 'owner', '--uid-owner', uid, '-m', 'comment', '--comment', tag, '-j', 'REJECT']),
             ('/usr/sbin/ip6tables', ['-m', 'owner', '--uid-owner', uid, '-m', 'comment', '--comment', tag, '-j', 'REJECT'])]
    for binary, rule in (reversed(rules) if install else rules):
        if install:
            command([binary, '-w', '5', '-I', 'OUTPUT', '1', *rule])
        else:
            found = subprocess.run([binary, '-w', '5', '-C', 'OUTPUT', *rule], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            if found.returncode == 0:
                command([binary, '-w', '5', '-D', 'OUTPUT', *rule])


def acl_paths(manifest):
    values = set()
    for value in manifest['read_only_paths'] + manifest['writable_paths']:
        parent = Path(value).parent
        while parent != Path('/'):
            values.add(str(parent))
            parent = parent.parent
    return sorted(values, key=lambda value: len(Path(value).parts))


def install_acl(record, manifest):
    uid = str(record['uid'])
    for path in record['ancestors']:
        command(['/usr/bin/setfacl', '-m', 'u:' + uid + ':--x', path])
    for path in manifest['writable_paths']:
        command(['/usr/bin/setfacl', '-R', '-P', '-m', 'u:' + uid + ':rwX', path])
    for path in manifest['read_only_paths']:
        command(['/usr/bin/setfacl', '-R', '-P', '-m', 'u:' + uid + ':r-X', path])


def release(record):
    with LOCK:
        current = json.loads(journal_path(record).read_text())
        if current.get('state') == 'RELEASED':
            return current
        record = current
        command(['/usr/bin/systemctl', 'stop', record['unit']], ok=(0, 1, 5), timeout=15)
        if not unit_empty(record['unit']):
            command(['/usr/bin/systemctl', 'kill', '--kill-who=all', '--signal=KILL', record['unit']], ok=(0, 1, 5))
        until = time.monotonic() + 5
        while not unit_empty(record['unit']) and time.monotonic() < until:
            time.sleep(.05)
        check(unit_empty(record['unit']), 'NATIVE_CGROUP_NOT_EMPTY')
        # A uid is never reused until all its processes are gone, even if a
        # process tried to escape the original tree (cgroup migration is denied).
        for proc in Path('/proc').iterdir():
            if proc.name.isdigit():
                try:
                    check(proc.stat().st_uid != record['uid'], 'NATIVE_UID_STILL_ACTIVE')
                except FileNotFoundError:
                    pass
        firewall(record, False)
        if Path(record['profile_path']).exists():
            profiles = Path('/sys/kernel/security/apparmor/profiles').read_text().splitlines()
            if any(line.startswith(record['profile'] + ' ') for line in profiles):
                command(['/usr/sbin/apparmor_parser', '-R', record['profile_path']], ok=(0,))
            Path(record['profile_path']).unlink()
        # Only the broker-bound per-run directories can be recursively removed.
        for name in record['write_paths']:
            path = safe_path(name, RUNTIME / 'agent-instances', exists=False)
            if path.exists():
                shutil.rmtree(path)
        # Remove only this role's named ACL entry, preserving all preexisting
        # application and other concurrent roles' permissions.
        for path in record['acl_targets']:
            target = checked_read_path(path, exists=False)
            if target.exists():
                command(['/usr/bin/setfacl', '-R', '-P', '-x', 'u:' + str(record['uid']), str(target)])
        for name in reversed(record['ancestors']):
            if Path(name).exists():
                command(['/usr/bin/setfacl', '-x', 'u:' + str(record['uid']), name])
        control = safe_path(record['control'], RUNTIME / 'agent-control')
        Path(record['environment_path']).unlink(missing_ok=True)
        command(['/usr/bin/setfacl', '-x', 'u:' + str(record['uid']), str(STATE)])
        # Ubuntu systemd requires a passwd/group entry even for numeric IDs.
        # The role account has no password, home directory or login shell.
        try:
            account = pwd.getpwnam(record['username'])
            check(account.pw_uid == record['uid'] and account.pw_dir == '/nonexistent'
                  and account.pw_shell == '/usr/sbin/nologin', 'NATIVE_ACCOUNT_BINDING')
            command(['/usr/sbin/userdel', record['username']])
        except KeyError:
            pass
        try:
            group = grp.getgrnam(record['username'])
            check(group.gr_gid == record['uid'] and not group.gr_mem, 'NATIVE_ACCOUNT_BINDING')
            command(['/usr/sbin/groupdel', record['username']])
        except KeyError:
            pass
        # Keep only a credential-free request so both the live launcher and a
        # detached reaper can repeat release after the process has exited.
        atomic_json(control / 'launch.json', record['clean_manifest'], (CONFIG['worker_uid'], CONFIG['worker_gid']))
        receipt = {'nonce': record['nonce'], 'run_id': record['run_id'], 'process_ref': record.get('process_ref', 'UNVERIFIED'),
                   'no_active_processes': True, 'credentials_removed': True, 'temporary_files_removed': True}
        atomic_json(control / 'native-cleanup.json', receipt, (CONFIG['worker_uid'], CONFIG['worker_gid']))
        record.update(state='RELEASED', released_at=dt.datetime.now(dt.timezone.utc).isoformat())
        save(record)
        return record


def allocate(manifest, key, binding):
    with LOCK:
        check(not (STATE / (key + '.json')).exists(), 'NATIVE_NONCE_REPLAY')
        used = set()
        for path in STATE.glob('*.json'):
            entry = json.loads(path.read_text())
            if entry.get('state') != 'RELEASED':
                used.add(entry['uid'])
        check(len(used) < CONFIG.get('max_concurrent', 8), 'NATIVE_CAPACITY')
        occupied = {entry.pw_uid for entry in pwd.getpwall()} | {entry.gr_gid for entry in grp.getgrall()}
        for proc in Path('/proc').iterdir():
            try:
                if proc.name.isdigit():
                    occupied.add(proc.stat().st_uid)
            except FileNotFoundError:
                pass
        uid = next((value for value in range(CONFIG.get('uid_min', 62000), CONFIG.get('uid_max', 62999) + 1)
                    if value not in used and value not in occupied), None)
        check(uid is not None and uid >= 10000, 'NATIVE_IDENTITY_CAPACITY')
        record = {'key': key, 'binding': binding, 'uid': uid, 'state': 'PREPARING',
                  'username': 'ypcc-agent-' + str(uid),
                  'instance_id': manifest['instance_id'], 'run_id': manifest['run_id'], 'nonce': manifest['nonce'],
                  'unit': 'ypcc-agent-' + key + '.service', 'profile': 'ypcc-agent-' + key,
                  'profile_path': str(STATE / (key + '.apparmor')),
                  'environment_path': str(STATE / (key + '.env')), 'clean_manifest': dict(manifest, environment={}),
                  'write_paths': manifest['writable_paths'], 'acl_targets': manifest['read_only_paths'] + manifest['writable_paths'],
                  'ancestors': acl_paths(manifest), 'control': str(Path(manifest['cleanup_receipt_path']).parent)}
        save(record)
        return record


def run_role(connection, reader, send, manifest, record):
    child = None
    try:
        with LOCK:
            command(['/usr/sbin/groupadd', '--gid', str(record['uid']), record['username']])
            command(['/usr/sbin/useradd', '--system', '--no-create-home', '--no-log-init', '--uid', str(record['uid']),
                     '--gid', str(record['uid']), '--home-dir', '/nonexistent', '--shell', '/usr/sbin/nologin', record['username']])
        Path(record['profile_path']).write_text(profile_text(record, manifest))
        command(['/usr/sbin/apparmor_parser', '-r', record['profile_path']])
        firewall(record, True)
        install_acl(record, manifest)
        # Root-owned, readable by only this fresh role UID. Never exposed as
        # systemd Environment= or command arguments; removed after exec.
        command(['/usr/bin/setfacl', '-m', 'u:' + str(record['uid']) + ':--x', str(STATE)])
        environment_path = Path(record['environment_path'])
        fd = os.open(environment_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
        env = dict(manifest['environment'], LANG='C.UTF-8', PATH='/usr/bin:/bin')
        with os.fdopen(fd, 'wb') as writer:
            writer.write(b''.join((name + '=' + value).encode() + b'\0' for name, value in env.items()))
        command(['/usr/bin/setfacl', '-m', 'u:' + str(record['uid']) + ':r--', str(environment_path)])
        remaining = dt.datetime.fromisoformat(manifest['deadline_at'].replace('Z', '+00:00')).timestamp() - time.time()
        check(remaining > 0, 'NATIVE_DEADLINE')
        seconds = max(1, int(remaining))
        args = ['/usr/bin/systemd-run', '--quiet', '--pipe', '--wait', '--collect', '--unit=' + record['unit'],
                '--uid=' + record['username'], '--gid=' + record['username'], '--working-directory=' + manifest['cwd'],
                '--property=AppArmorProfile=' + record['profile'], '--property=KillMode=control-group',
                '--property=NoNewPrivileges=yes', '--property=CapabilityBoundingSet=', '--property=AmbientCapabilities=',
                '--property=RestrictSUIDSGID=yes', '--property=UMask=0077', '--property=TasksMax=64',
                '--property=MemoryMax=' + str(CONFIG.get('memory_max_bytes', 2147483648)),
                '--property=RuntimeMaxSec=' + str(seconds), '--property=TimeoutStopSec=3s',
                '--property=LimitCORE=0',
                '--property=RestrictAddressFamilies=AF_INET AF_INET6',
                '--property=RestrictNamespaces=yes']
        args += ['--', CONFIG['env_exec'], str(environment_path), manifest['executable'], *manifest['args']]
        child = subprocess.Popen(args, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                 env={'PATH': '/usr/bin:/bin', 'LANG': 'C.UTF-8'}, bufsize=0)
        # A short startup wait binds the actual kernel UID and AppArmor profile,
        # not a caller-provided pid or an unverified systemd-run wrapper.
        until = time.monotonic() + 7
        props = {}
        while time.monotonic() < until:
            props = system_properties(record['unit'])
            pid = int(props.get('MainPID', '0'))
            if pid and props.get('ActiveState') == 'active':
                proc = Path('/proc') / str(pid)
                try:
                    # systemd exposes MainPID before the child finishes dropping
                    # privileges/attaching AppArmor. Wait for the effective
                    # identity instead of treating that transient as a receipt.
                    if proc.stat().st_uid == record['uid'] and proc.joinpath('attr/current').read_text().startswith(record['profile'] + ' ') \
                            and os.readlink(proc / 'exe') == manifest['executable']:
                        break
                except FileNotFoundError:
                    pass
            check(child.poll() is None, 'NATIVE_PROCESS_FAILED')
            time.sleep(.025)
        else:
            raise ValueError('NATIVE_START_TIMEOUT')
        record.update(state='ACTIVE', process_ref=record['unit'] + ':' + props['InvocationID'])
        environment_path.unlink(missing_ok=True)
        save(record)
        receipt = {'version': manifest['version'], 'nonce': manifest['nonce'], 'instance_id': manifest['instance_id'], 'run_id': manifest['run_id'],
                   'process_ref': record['process_ref'], 'os_identity_ref': 'linux:uid:' + str(record['uid']) + ':apparmor:' + record['profile'],
                   'isolation': 'NATIVE_RESTRICTED_IDENTITY', 'virtualization': 'FORBIDDEN', 'shell_tools': 'DISABLED', 'process_tree_bound': True}
        atomic_json(manifest['launch_receipt_path'], receipt, (CONFIG['worker_uid'], CONFIG['worker_gid']))

        def output_loop(stream, name):
            try:
                while True:
                    chunk = stream.read(32768)
                    if not chunk:
                        return
                    send({name: base64.b64encode(chunk).decode()})
            except OSError:
                return

        output_threads = [threading.Thread(target=output_loop, args=(stream, name), daemon=True)
                          for stream, name in ((child.stdout, 'stdout'), (child.stderr, 'stderr'))]
        for thread in output_threads:
            thread.start()

        def stdin_loop():
            try:
                while child.poll() is None:
                    line = reader.readline(100000)
                    if not line:
                        release(record)
                        return
                    check(line.endswith(b'\n'), 'NATIVE_FRAME_LIMIT')
                    frame = json.loads(line)
                    if frame.get('eof') is True:
                        child.stdin.close()
                        return
                    chunk = base64.b64decode(frame['stdin'], validate=True)
                    check(len(chunk) <= 32768, 'NATIVE_FRAME_LIMIT')
                    pending = memoryview(chunk)
                    while pending:
                        written = child.stdin.write(pending)
                        check(written is not None and written > 0, 'NATIVE_INPUT_CLOSED')
                        pending = pending[written:]
                    child.stdin.flush()
            except (OSError, ValueError, KeyError):
                try:
                    release(record)
                except Exception:
                    pass

        threading.Thread(target=stdin_loop, daemon=True).start()
        code = child.wait(timeout=seconds + 10)
        for thread in output_threads:
            thread.join(timeout=2)
        release(record)
        send({'exit': code if 0 <= code <= 255 else 1})
    finally:
        # Failure is durable and retried on broker restart; never forge success.
        try:
            release(record)
        finally:
            if child and child.poll() is None:
                child.kill()
                child.wait(timeout=3)


def handle(connection):
    send_lock = threading.Lock()

    def send(message):
        with send_lock:
            connection.sendall(canonical(message) + b'\n')

    try:
        _, uid, _ = struct.unpack('3i', connection.getsockopt(socket.SOL_SOCKET, socket.SO_PEERCRED, 12))
        check(uid == CONFIG['worker_uid'], 'NATIVE_PEER_DENIED')
        send({'native_build': {'broker_sha256': digest(__file__), 'env_exec_sha256': digest(CONFIG['env_exec'])}})
        connection.settimeout(10)
        with connection.makefile('rb') as reader:
            line = reader.readline(4096)
            check(line.endswith(b'\n'), 'NATIVE_REQUEST_LIMIT')
            request = json.loads(line)
            action = request.get('action')
            check(action in ('run', 'release'), 'NATIVE_ACTION_INVALID')
            manifest, key, binding = read_manifest(request.get('manifest'), action)
            if action == 'release':
                with LOCK:
                    path = STATE / (key + '.json')
                    check(path.is_file(), 'NATIVE_RELEASE_NOT_FOUND')
                    record = json.loads(path.read_text())
                    check(record['binding'] == binding, 'NATIVE_RELEASE_BINDING')
                release(record)
                send({'exit': 0})
            else:
                record = allocate(manifest, key, binding)
                connection.settimeout(None)
                run_role(connection, reader, send, manifest, record)
    except Exception as error:
        # Error type/code is safe; manifest and arbitrary exception text aren't.
        code = str(error) if isinstance(error, ValueError) and re.fullmatch(r'NATIVE_[A-Z_:a-z0-9.-]+', str(error)) else type(error).__name__
        print(json.dumps({'event': 'native_agent_error', 'code': code}), flush=True)
        try:
            send({'exit': 1})
        except OSError:
            pass
    finally:
        connection.close()


def main():
    global CONFIG, STATE, RUNTIME
    parser = argparse.ArgumentParser()
    parser.add_argument('--config', default='/root/cfg/one-tap-assets/native-launcher.json')
    args = parser.parse_args()
    check(os.geteuid() == 0, 'NATIVE_ROOT_REQUIRED')
    cfg_path = Path(args.config)
    info = cfg_path.lstat()
    check(stat.S_ISREG(info.st_mode) and info.st_uid == 0 and info.st_mode & 0o077 == 0, 'NATIVE_CONFIG_PERMISSIONS')
    CONFIG = json.loads(cfg_path.read_text())
    project = Path(CONFIG['project_root'])
    check(project.resolve() == project and CONFIG['worker_uid'] != 0 and CONFIG['worker_gid'] != 0, 'NATIVE_CONFIG_INVALID')
    RUNTIME = safe_path(CONFIG['runtime_root'], project)
    # Initial production adapter intentionally supports only the API's private
    # IPv4 loopback origin. External inference still uses the platform proxy.
    parsed = urlsplit(CONFIG['gateway_origin'])
    check(parsed.scheme == 'http' and parsed.hostname == '127.0.0.1' and parsed.port
          and parsed.path in ('', '/') and not parsed.query and not parsed.fragment and not parsed.username and not parsed.password,
          'NATIVE_GATEWAY_LOOPBACK_REQUIRED')
    check(Path('/sys/module/apparmor/parameters/enabled').read_text().strip() == 'Y'
          and Path('/sys/fs/cgroup/cgroup.controllers').exists(), 'NATIVE_KERNEL_UNAVAILABLE')
    for binary in ('/usr/bin/systemd-run', '/usr/sbin/apparmor_parser', '/usr/sbin/iptables', '/usr/sbin/ip6tables', '/usr/bin/setfacl'):
        check(Path(binary).is_file(), 'NATIVE_DEPENDENCY_MISSING')
    STATE = Path(CONFIG.get('state_root', '/var/lib/one-tap-assets-agent'))
    check(str(STATE).startswith('/var/lib/one-tap-assets-agent'), 'NATIVE_STATE_ROOT_INVALID')
    STATE.mkdir(mode=0o700, parents=True, exist_ok=True)
    # Named active-role ACLs grant traversal only; journal files remain root0600.
    check(STATE.stat().st_uid == 0 and STATE.stat().st_mode & 0o067 == 0 and not STATE.is_symlink(), 'NATIVE_STATE_PERMISSIONS')
    # No role is adopted across broker restarts. First reap all durable owned
    # resources; if that fails, stay unavailable rather than leak/reuse a UID.
    for path in STATE.glob('*.json'):
        record = json.loads(path.read_text())
        if record.get('state') != 'RELEASED':
            release(record)
    sock_path = Path(CONFIG.get('socket', '/run/one-tap-assets-agent/launcher.sock'))
    check(str(sock_path).startswith('/run/one-tap-assets-agent/'), 'NATIVE_SOCKET_INVALID')
    sock_path.parent.mkdir(mode=0o750, parents=True, exist_ok=True)
    os.chown(sock_path.parent, 0, CONFIG['worker_gid'])
    os.chmod(sock_path.parent, 0o750)
    sock_path.unlink(missing_ok=True)
    server = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    server.bind(str(sock_path))
    os.chown(sock_path, 0, CONFIG['worker_gid'])
    os.chmod(sock_path, 0o660)
    server.listen(16)
    print(json.dumps({'event': 'native_agent_broker_ready', 'configured_runtime': bool(CONFIG.get('executable'))}), flush=True)
    while True:
        connection, _ = server.accept()
        threading.Thread(target=handle, args=(connection,), daemon=True).start()


if __name__ == '__main__':
    main()
