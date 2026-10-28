import { spawn } from 'node:child_process';
import { rm } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { inside } from '../../src/api/config.js';
import { AppError } from '../../src/api/lib/errors.js';
import type { NativeLaunchManifest, NativeLaunchReceipt, NativeCleanupReceipt, RoleLauncher, RoleProcess } from '../../src/worker/codex/launcher.js';

/** Same-user synthetic process ONLY for protocol tests, never OS-isolation
 * evidence. The production main entry cannot inject this launcher. */
export class FixtureLauncher implements RoleLauncher {
  launches = 0;
  constructor(private mode = 'NORMAL', private failCleanup = false) {}
  async launch(_path: string, manifest: NativeLaunchManifest): Promise<RoleProcess> {
    this.launches++;
    const child = spawn(process.execPath, [resolve('tests/fixtures/codex-role.cjs')], { cwd: manifest.cwd, shell: false, windowsHide: true,
      env: { ...manifest.environment, YPCC_SYNTHETIC_MODE: this.mode, YPCC_SYNTHETIC_BRIDGE: resolve('runtime/build/worker/tool-gateway/mcp-main.js') }, stdio: ['pipe', 'pipe', 'pipe'] });
    const receipt: NativeLaunchReceipt = { version: manifest.version, nonce: manifest.nonce, instance_id: manifest.instance_id, run_id: manifest.run_id,
      process_ref: `SYNTHETIC-ONLY:${child.pid}`, os_identity_ref: 'SYNTHETIC-NOT-RESTRICTED', isolation: 'NATIVE_RESTRICTED_IDENTITY',
      virtualization: 'FORBIDDEN', shell_tools: 'DISABLED', process_tree_bound: true };
    return { child, receipt, stop: async (): Promise<NativeCleanupReceipt> => {
      if (child.exitCode === null && child.signalCode === null) {
        child.stdin.end(); await new Promise<void>((res, rej) => {
          const timer = setTimeout(() => { child.kill(); rej(new Error('Synthetic process did not stop')); }, 5000);
          child.once('close', () => { clearTimeout(timer); res(); });
        });
      }
      const root = inside(resolve('runtime/agent-instances'), dirname(dirname(manifest.cwd)));
      for (const path of manifest.writable_paths) await rm(inside(root, path), { recursive: true, force: true });
      if (this.failCleanup) throw new AppError('CODEX_CLEANUP_UNVERIFIED', 'Synthetic missing cleanup evidence', 503);
      return { nonce: manifest.nonce, run_id: manifest.run_id, process_ref: receipt.process_ref,
        no_active_processes: true, credentials_removed: true, temporary_files_removed: true };
    } };
  }
}
