import { lstat, readdir, unlink, rmdir, chmod } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { inside, type Config } from '../../api/config.js';
import { requireThat } from '../../api/lib/errors.js';
import { checkedProjectPath } from '../codex/launcher.js';

export async function absent(path: string): Promise<boolean> {
  try { await lstat(path); return false; } catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') return true; throw e; }
}
/** No recursive shell deletion or link traversal. Validate the resolved target
 * and every child; a reparse point fails closed for operator reconciliation. */
export async function removeInstanceTree(cfg: Config, root: string, expectedRoot: string): Promise<void> {
  requireThat(resolve(root) === resolve(expectedRoot) && inside(cfg.runtimeRoot, root) === resolve(root), 'CLEANUP_PATH_INVALID', '清理目录不属于登记实例', 503);
  if (await absent(root)) return;
  await checkedProjectPath(cfg, root); let count = 0;
  const remove = async (path: string, depth: number): Promise<void> => {
    requireThat(depth <= 40 && ++count <= 20000, 'CLEANUP_PATH_LIMIT', '实例文件数量或深度超过清理限制', 503);
    inside(root, path); const info = await lstat(path);
    requireThat(!info.isSymbolicLink(), 'CODEX_PATH_REPARSE', '清理路径含链接或重解析点', 503);
    if (info.isDirectory()) { for (const name of await readdir(path)) await remove(join(path, name), depth + 1); await rmdir(path); }
    else {
      requireThat(info.isFile(), 'CLEANUP_PATH_INVALID', '清理路径包含未知文件类型', 503);
      try { await unlink(path); } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EPERM') throw error;
        await checkedProjectPath(cfg, path); await chmod(path, 0o600); await unlink(path);
      }
    }
  };
  await remove(root, 0);
}
