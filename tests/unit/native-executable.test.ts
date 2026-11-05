import { it, expect } from 'vitest';
import { mkdtemp, writeFile, chmod, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { checkedNativeExecutable } from '../../src/worker/codex/launcher.js';

it('accepts Linux ELF and the pinned Python client while rejecting shells, Windows bytes and interpreter substitutes', async () => {
  const root = await mkdtemp(resolve('runtime/tmp/native-executable-'));
  const elf = join(root, 'codex'); const client = join(root, 'agent-launcher');
  const fake = join(root, 'fake-runtime'); const shell = join(root, 'bash');
  try {
    await writeFile(elf, Buffer.from([0x7f, 0x45, 0x4c, 0x46]));
    await writeFile(client, '#!/usr/bin/python3\n# operator-pinned client, not model runtime\n');
    await writeFile(fake, '#!/bin/bash\n'); await writeFile(shell, Buffer.from([0x7f, 0x45, 0x4c, 0x46]));
    for (const path of [elf, client, fake, shell]) await chmod(path, 0o755);
    await expect(checkedNativeExecutable(elf, 'runtime', 'linux')).resolves.toBeUndefined();
    await expect(checkedNativeExecutable(client, 'launcher', 'linux')).resolves.toBeUndefined();
    for (const [path, kind] of [[client, 'runtime'], [fake, 'launcher'], [shell, 'launcher']] as const) {
      await expect(checkedNativeExecutable(path, kind, 'linux')).rejects.toMatchObject({ code: 'CODEX_LAUNCHER_INVALID' });
    }
    await expect(checkedNativeExecutable(elf, 'runtime', 'win32')).rejects.toMatchObject({ code: 'CODEX_LAUNCHER_INVALID' });
    await expect(checkedNativeExecutable(elf, 'runtime', 'darwin')).rejects.toMatchObject({ code: 'CODEX_PLATFORM_UNSUPPORTED' });
  } finally { await rm(root, { recursive: true, force: true }); }
});
