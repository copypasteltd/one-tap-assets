import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { readFile, writeFile, lstat, realpath } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, relative, resolve, sep } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import type { Config } from '../../api/config.js';
import { inside } from '../../api/config.js';
import { AppError, requireThat } from '../../api/lib/errors.js';
import { object } from '../../shared/domain/json.js';
import type { CodexAdmission } from './admission.js';
import { hash } from '../../api/lib/crypto.js';

export interface NativeLaunchManifest {
  version: 'YPCC-NATIVE-LAUNCH-1'; nonce: string; instance_id: string; run_id: string;
  executable: string; executable_sha256: string; args: string[]; cwd: string;
  environment: Record<string, string>; read_only_paths: string[]; writable_paths: string[];
  virtualization: 'FORBIDDEN'; shell_tools: 'DISABLED'; network_origins: string[];
  deadline_at: string; launch_receipt_path: string; cleanup_receipt_path: string;
}
export interface NativeLaunchReceipt {
  version: 'YPCC-NATIVE-LAUNCH-1'; nonce: string; instance_id: string; run_id: string;
  process_ref: string; os_identity_ref: string; isolation: 'NATIVE_RESTRICTED_IDENTITY';
  virtualization: 'FORBIDDEN'; shell_tools: 'DISABLED'; process_tree_bound: true;
}
export interface NativeCleanupReceipt {
  nonce: string; run_id: string; process_ref: string;
  no_active_processes: true; credentials_removed: true; temporary_files_removed: true;
}
export interface RoleProcess {
  child: ChildProcessWithoutNullStreams; receipt: NativeLaunchReceipt;
  stop(): Promise<NativeCleanupReceipt>;
}
export interface RoleLauncher { launch(manifestPath: string, manifest: NativeLaunchManifest, signal: AbortSignal): Promise<RoleProcess> }
export interface CleanupBinding {
  version: 'YPCC-CLEANUP-1'; manifest: NativeLaunchManifest; manifest_hash: string; launcher_path: string;
  launcher_sha256: string; mode: 'ADMITTED_NATIVE' | 'SYNTHETIC_PROTOCOL';
}
export interface DetachedCleaner { release(binding: CleanupBinding, processRef: string | null, signal: AbortSignal): Promise<NativeCleanupReceipt> }

/** Reject symlink/junction traversal. Paths are only a path-safety check;
 * the admitted native launcher must enforce identities, ACLs and process jobs. */
export async function checkedProjectPath(cfg: Config, path: string): Promise<string> {
  const target = inside(cfg.projectRoot, path); const root = resolve(cfg.projectRoot);
  const parts = relative(root, target).split(sep).filter(Boolean); let cursor = root;
  for (const part of parts) {
    cursor = resolve(cursor, part); const info = await lstat(cursor);
    requireThat(!info.isSymbolicLink(), 'CODEX_PATH_REPARSE', '运行路径不可经过链接或重解析点', 503);
  }
  requireThat(resolve(await realpath(target)).toLowerCase() === target.toLowerCase(), 'CODEX_PATH_REPARSE', '运行路径解析不一致', 503);
  return target;
}
async function fileDigest(path: string): Promise<string> {
  const digest = createHash('sha256'); let count = 0;
  for await (const chunk of createReadStream(path)) {
    count += chunk.length; requireThat(count <= 1000000000, 'CODEX_BUILD_INVALID', '运行文件超过大小限制', 503); digest.update(chunk);
  }
  return digest.digest('hex');
}
async function readReceipt(path: string): Promise<Record<string, unknown> | null> {
  try { const info = await lstat(path); requireThat(info.isFile() && !info.isSymbolicLink() && info.size <= 16000, 'CODEX_LAUNCH_RECEIPT_INVALID', '原生启动回执无效', 503); return object(JSON.parse(await readFile(path, 'utf8'))); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; }
}
/** Infrastructure adapter for an operator-supplied, hash-pinned native
 * restricted-identity launcher. Never falls back to a same-user process,
 * PowerShell, cmd, Docker, WSL or a personal Codex profile. */
export class NativeRoleLauncher implements RoleLauncher {
  constructor(private cfg: Config, private admission: CodexAdmission) {}
  async launch(manifestPath: string, manifest: NativeLaunchManifest, signal: AbortSignal): Promise<RoleProcess> {
    requireThat(!signal.aborted && Date.parse(manifest.deadline_at) > Date.now(), 'CODEX_TURN_INTERRUPTED', '执行授权已结束', 409);
    const launcher = await checkedProjectPath(this.cfg, this.cfg.codex.isolationCommand);
    const binary = await checkedProjectPath(this.cfg, manifest.executable);
    requireThat(/\.exe$/i.test(launcher) && /\.exe$/i.test(binary) && !/^(?:docker|wsl|cmd|powershell|pwsh|bash)\.exe$/i.test(launcher.split(/[\\/]/).at(-1)!),
      'CODEX_LAUNCHER_INVALID', '只允许锁定的原生运行程序', 503);
    requireThat(await fileDigest(launcher) === this.admission.launcher_sha256 && await fileDigest(binary) === this.admission.runtime_sha256,
      'CODEX_BUILD_HASH_MISMATCH', 'Codex 或原生隔离器构建摘要不匹配', 503);
    await checkedProjectPath(this.cfg, manifestPath);
    const environment: NodeJS.ProcessEnv = { SystemRoot: process.env.SystemRoot ?? 'C:\\Windows', WINDIR: process.env.WINDIR ?? 'C:\\Windows',
      TEMP: dirname(manifestPath), TMP: dirname(manifestPath) };
    const child = spawn(launcher, ['run', '--manifest', manifestPath], { cwd: dirname(manifestPath), env: environment,
      stdio: ['pipe', 'pipe', 'pipe'], shell: false, windowsHide: true });
    let spawnFailed = false; child.once('error', () => { spawnFailed = true; });
    const cleanup = async (receipt: NativeLaunchReceipt): Promise<NativeCleanupReceipt> => {
      // The launcher owns the process tree and verifies its nonce/process
      // creation identity. Killing arbitrary numeric PIDs is never a fallback.
      const command = spawn(launcher, ['release', '--manifest', manifestPath], { cwd: dirname(manifestPath), env: environment,
        shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
      command.stdout.resume(); command.stderr.resume(); command.stdin.end();
      const exit = await new Promise<number | null>((res, rej) => {
        const timer = setTimeout(() => { command.kill(); rej(new AppError('CODEX_CLEANUP_UNVERIFIED', '原生进程树清理尚未得到确认', 503)); }, 30000);
        command.once('error', () => { clearTimeout(timer); rej(new AppError('CODEX_CLEANUP_UNVERIFIED', '原生清理程序无法启动', 503)); });
        command.once('close', code => { clearTimeout(timer); res(code); });
      });
      const result = await readReceipt(manifest.cleanup_receipt_path);
      requireThat(exit === 0 && result?.nonce === manifest.nonce && result.run_id === manifest.run_id && result.process_ref === receipt.process_ref
        && result.no_active_processes === true && result.credentials_removed === true && result.temporary_files_removed === true
        && (child.exitCode !== null || child.signalCode !== null), 'CODEX_CLEANUP_UNVERIFIED', '原生实例释放回执尚未核验通过', 503);
      return result as unknown as NativeCleanupReceipt;
    };
    const until = Math.min(Date.now() + 10000, Date.parse(manifest.deadline_at));
    let receipt: NativeLaunchReceipt | null = null;
    try {
      while (Date.now() < until) {
        const raw = await readReceipt(manifest.launch_receipt_path);
        if (raw) {
          requireThat(raw.version === manifest.version && raw.nonce === manifest.nonce && raw.instance_id === manifest.instance_id && raw.run_id === manifest.run_id
            && typeof raw.process_ref === 'string' && raw.process_ref.length <= 200 && raw.process_ref.length > 0
            && typeof raw.os_identity_ref === 'string' && raw.os_identity_ref.length > 0 && raw.os_identity_ref.length <= 200
            && raw.isolation === 'NATIVE_RESTRICTED_IDENTITY' && raw.virtualization === 'FORBIDDEN'
            && raw.shell_tools === 'DISABLED' && raw.process_tree_bound === true, 'CODEX_LAUNCH_RECEIPT_INVALID', '原生隔离身份或进程树证据不匹配', 503);
          receipt = raw as unknown as NativeLaunchReceipt; break;
        }
        requireThat(!spawnFailed && child.exitCode === null && child.signalCode === null, 'CODEX_PROCESS_UNAVAILABLE', '原生受限进程未能启动', 503);
        await delay(25, undefined, { signal });
      }
      requireThat(receipt && !signal.aborted, 'CODEX_LAUNCH_UNVERIFIED', '原生启动未在截止前提供隔离证据', 503);
      const launchReceipt = receipt; let stopped: Promise<NativeCleanupReceipt> | null = null;
      return { child, receipt: launchReceipt, stop: () => stopped ??= cleanup(launchReceipt) };
    } catch (error) {
      // Release also handles failed starts by the manifest nonce. A failure is
      // left for the durable reaper, never recorded as a successful release.
      const provisional = receipt ?? { process_ref: 'UNVERIFIED' } as NativeLaunchReceipt;
      await cleanup(provisional).catch(() => {}); throw error;
    }
  }
}
/** Replays a frozen, credential-free release plan after its original Worker
 * has died. Cleanup intentionally remains possible after model admission expiry. */
export class NativeDetachedCleaner implements DetachedCleaner {
  constructor(private cfg: Config) {}
  async release(binding: CleanupBinding, processRef: string | null, signal: AbortSignal): Promise<NativeCleanupReceipt> {
    requireThat(!signal.aborted && binding.mode === 'ADMITTED_NATIVE' && hash(binding.manifest) === binding.manifest_hash
      && Object.keys(binding.manifest.environment).length === 0, 'CODEX_CLEANUP_BINDING_INVALID', '清理计划缺失、变更或包含凭证', 503);
    const launcher = await checkedProjectPath(this.cfg, binding.launcher_path);
    requireThat(/\.exe$/i.test(launcher) && !/^(?:docker|wsl|cmd|powershell|pwsh|bash)\.exe$/i.test(launcher.split(/[\\/]/).at(-1)!)
      && await fileDigest(launcher) === binding.launcher_sha256, 'CODEX_BUILD_HASH_MISMATCH', '原生清理程序与冻结构建不一致', 503);
    const directory = dirname(binding.manifest.cleanup_receipt_path); await checkedProjectPath(this.cfg, directory);
    const path = resolve(directory, 'release-request.json');
    try { await writeFile(path, JSON.stringify(binding.manifest), { flag: 'wx', mode: 0o600 }); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      await checkedProjectPath(this.cfg, path);
      requireThat(hash(JSON.parse(await readFile(path, 'utf8'))) === binding.manifest_hash, 'CODEX_CLEANUP_BINDING_INVALID', '已有清理计划与冻结记录不一致', 503);
    }
    const child = spawn(launcher, ['release', '--manifest', path], { cwd: directory, shell: false, windowsHide: true,
      env: { SystemRoot: process.env.SystemRoot ?? 'C:\\Windows', WINDIR: process.env.WINDIR ?? 'C:\\Windows', TEMP: directory, TMP: directory },
      stdio: ['pipe', 'pipe', 'pipe'] });
    child.stdin.end(); child.stdout.resume(); child.stderr.resume(); const stop = (): void => { child.kill(); };
    signal.addEventListener('abort', stop, { once: true }); if (signal.aborted) stop();
    const exit = await new Promise<number | null>((res, rej) => {
      const timer = setTimeout(() => { stop(); rej(new AppError('CODEX_CLEANUP_UNVERIFIED', '原生清理未在时限内完成', 503)); }, 30000);
      child.once('error', () => { clearTimeout(timer); rej(new AppError('CODEX_CLEANUP_UNVERIFIED', '原生清理程序无法启动', 503)); });
      child.once('close', code => { clearTimeout(timer); res(code); });
    }).finally(() => signal.removeEventListener('abort', stop));
    const result = await readReceipt(binding.manifest.cleanup_receipt_path);
    requireThat(exit === 0 && !signal.aborted && result?.nonce === binding.manifest.nonce && result.run_id === binding.manifest.run_id
      && typeof result.process_ref === 'string' && result.process_ref.length > 0 && result.process_ref.length <= 200
      && (!processRef || result.process_ref === processRef) && result.no_active_processes === true
      && result.credentials_removed === true && result.temporary_files_removed === true,
      'CODEX_CLEANUP_UNVERIFIED', '原生实例清理回执尚未核验通过', 503);
    return result as unknown as NativeCleanupReceipt;
  }
}
