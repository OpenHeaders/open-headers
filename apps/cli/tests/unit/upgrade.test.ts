/**
 * `oh upgrade` — ownership refusal from static path facts, the feed →
 * SHA256SUMS → verified-bytes pipeline, the atomic swap (POSIX rename
 * over; Windows rename-aside with lazy `.old` cleanup), the re-exec
 * probe, and `--channel` persistence under the merge law.
 */

import { createHash } from 'node:crypto';
import { mkdtemp, readdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readCliConfig } from '../../src/config-store';
import { OperationFailedError, UsageError } from '../../src/exit-codes';
import {
  commandUpgrade,
  detectInstallOwner,
  findAssetInSums,
  platformAssetLeg,
  type UpgradeDeps,
} from '../../src/upgrade';

let dir: string;
let configPath: string;
let binaryPath: string;

const NEW_BYTES = Buffer.from('new oh binary payload');
const NEW_SHA = createHash('sha256').update(NEW_BYTES).digest('hex');

beforeEach(async () => {
  // Canonicalize: macOS mkdtemp answers a /var/folders symlink that the
  // implementation's realpath resolves to /private/var — asserts on the
  // binary path must live in the canonical form.
  dir = await realpath(await mkdtemp(path.join(os.tmpdir(), 'oh-cli-upgrade-')));
  configPath = path.join(dir, 'openheaders', 'cli.json');
  binaryPath = path.join(dir, 'oh');
  await writeFile(binaryPath, 'old oh binary payload', { mode: 0o755 });
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const STABLE_URL = 'https://updates.openheaders.com/versions/stable.json';
const BETA_URL = 'https://updates.openheaders.com/versions/beta.json';

function feedFetch(byUrl: Record<string, () => Response>): typeof fetch {
  return vi.fn(async (input: RequestInfo | URL) => {
    const handler = byUrl[String(input)];
    if (!handler) throw new Error(`unexpected fetch: ${String(input)}`);
    return handler();
  }) as unknown as typeof fetch;
}

function stableFeed(asset: string, sha: string = NEW_SHA): Record<string, () => Response> {
  return {
    [STABLE_URL]: () =>
      new Response(JSON.stringify({ cli: { latest: '2026.7.19', tag: 'v2026.7.19', severity: 'normal' } })),
    'https://updates.openheaders.com/dl/v2026.7.19/SHA256SUMS.txt': () =>
      new Response(
        [
          `${'a'.repeat(64)}  ohd-2026.7.19-linux-x64`,
          `${sha}  ${asset}`,
          `${'b'.repeat(64)}  oh-2026.7.19-mac-arm64`,
        ].join('\n'),
      ),
    [`https://updates.openheaders.com/dl/v2026.7.19/${asset}`]: () => new Response(new Uint8Array(NEW_BYTES)),
  };
}

function baseDeps(fetchFn: typeof fetch, overrides: Partial<UpgradeDeps> = {}) {
  return {
    env: {},
    configPath,
    cliVersion: '2026.7.0',
    fetchFn,
    execPath: binaryPath,
    scriptPath: '',
    platform: 'linux' as NodeJS.Platform,
    arch: 'x64',
    probeFn: vi.fn(() => ({ status: 0, stdout: '2026.7.19\n' })),
    ...overrides,
  };
}

describe('detectInstallOwner', () => {
  it('claims npm for a non-compiled runtime or a node_modules script', () => {
    expect(detectInstallOwner('/usr/local/bin/node', '/usr/local/bin/node', '/x/dist/cli.js')).toBe('npm');
    expect(detectInstallOwner('C:\\nodejs\\node.exe', 'C:\\nodejs\\node.exe', 'C:\\x\\cli.js')).toBe('npm');
    expect(detectInstallOwner('/home/dev/.bun/bin/bun', '/home/dev/.bun/bin/bun', '/x/cli.ts')).toBe('npm');
    expect(
      detectInstallOwner('/home/dev/bin/oh', '/home/dev/bin/oh', '/lib/node_modules/@openheaders/cli/dist/cli.js'),
    ).toBe('npm');
  });

  it('claims brew for a cellar-resolved binary and system for /usr outside /usr/local', () => {
    expect(detectInstallOwner('/opt/homebrew/bin/oh', '/opt/homebrew/Cellar/oh/2026.7.0/bin/oh', '')).toBe('brew');
    expect(detectInstallOwner('/usr/bin/oh', '/usr/bin/oh', '')).toBe('system');
    expect(detectInstallOwner('/usr/local/bin/oh', '/usr/local/bin/oh', '')).toBeNull();
  });

  it('claims nothing for a user-dir compiled binary', () => {
    expect(detectInstallOwner('/home/dev/.local/bin/oh', '/home/dev/.local/bin/oh', '')).toBeNull();
  });
});

describe('platformAssetLeg', () => {
  it('mirrors the install scripts: mac-arm64, linux-x64, win-x64, else none', () => {
    expect(platformAssetLeg('darwin', 'arm64')).toBe('mac-arm64');
    expect(platformAssetLeg('linux', 'x64')).toBe('linux-x64');
    expect(platformAssetLeg('win32', 'x64')).toBe('win-x64');
    expect(platformAssetLeg('darwin', 'x64')).toBeNull();
    expect(platformAssetLeg('linux', 'arm64')).toBeNull();
  });
});

describe('findAssetInSums', () => {
  it('picks the oh line for the leg, never ohd, and honors the .exe suffix', () => {
    const sums = [
      `${'a'.repeat(64)}  ohd-2026.7.19-linux-x64`,
      `${'b'.repeat(64)}  oh-2026.7.19-linux-x64`,
      `${'c'.repeat(64)}  oh-2026.7.19-win-x64.exe`,
    ].join('\n');
    expect(findAssetInSums(sums, 'linux-x64')).toEqual({ sha256: 'b'.repeat(64), asset: 'oh-2026.7.19-linux-x64' });
    expect(findAssetInSums(sums, 'win-x64')).toEqual({ sha256: 'c'.repeat(64), asset: 'oh-2026.7.19-win-x64.exe' });
    expect(findAssetInSums(sums, 'mac-arm64')).toBeNull();
  });
});

describe('commandUpgrade', () => {
  it('refuses a development build', async () => {
    await expect(commandUpgrade([], baseDeps(feedFetch({}), { cliVersion: 'dev' }))).rejects.toThrow(
      /development build/,
    );
  });

  it('refuses when a package manager owns the install, naming it', async () => {
    await expect(
      commandUpgrade([], baseDeps(feedFetch({}), { execPath: '/usr/local/bin/node', scriptPath: '/x/dist/cli.js' })),
    ).rejects.toThrow(/npm install -g @openheaders\/cli/);
  });

  it('reports up to date when the manifest offers nothing newer', async () => {
    const fetchFn = feedFetch({
      [STABLE_URL]: () =>
        new Response(JSON.stringify({ cli: { latest: '2026.7.0', tag: 'v2026.7.0', severity: 'normal' } })),
    });
    expect(await commandUpgrade([], baseDeps(fetchFn))).toEqual(['oh is up to date (2026.7.0, stable channel)']);
  });

  it('downloads, verifies, and atomically replaces the binary, then probes it', async () => {
    const deps = baseDeps(feedFetch(stableFeed('oh-2026.7.19-linux-x64')));
    const lines = await commandUpgrade([], deps);
    expect(lines).toEqual(['upgraded oh 2026.7.0 → 2026.7.19 (oh-2026.7.19-linux-x64, stable channel)']);
    expect(await readFile(binaryPath)).toEqual(NEW_BYTES);
    expect(deps.probeFn).toHaveBeenCalledWith(binaryPath, expect.objectContaining({ OH_NO_UPDATE_CHECK: '1' }));
    expect((await readdir(dir)).filter((name) => name.startsWith('.oh-upgrade-'))).toEqual([]);
  });

  it('refuses a checksum mismatch and leaves the binary untouched', async () => {
    const deps = baseDeps(feedFetch(stableFeed('oh-2026.7.19-linux-x64', 'd'.repeat(64))));
    await expect(commandUpgrade([], deps)).rejects.toThrow(/checksum mismatch/);
    expect(await readFile(binaryPath, 'utf8')).toBe('old oh binary payload');
  });

  it('on Windows renames the running exe aside and cleans a leftover .old', async () => {
    const exePath = path.join(dir, 'oh.exe');
    await writeFile(exePath, 'old oh binary payload');
    await writeFile(`${exePath}.old`, 'leftover from the last upgrade');
    const deps = baseDeps(feedFetch(stableFeed('oh-2026.7.19-win-x64.exe')), {
      execPath: exePath,
      platform: 'win32' as NodeJS.Platform,
    });
    await commandUpgrade([], deps);
    expect(await readFile(exePath)).toEqual(NEW_BYTES);
    const names = await readdir(dir);
    expect(names).not.toContain('oh.exe.old');
    expect(names.filter((name) => name.startsWith('.oh-upgrade-'))).toEqual([]);
  });

  it('surfaces a failed --version probe after the swap', async () => {
    const deps = baseDeps(feedFetch(stableFeed('oh-2026.7.19-linux-x64')), {
      probeFn: vi.fn(() => ({ status: 1, stdout: '' })),
    });
    await expect(commandUpgrade([], deps)).rejects.toThrow(/--version probe/);
  });

  it('persists --channel like oh channel and reads that channel manifest', async () => {
    const fetchFn = feedFetch({
      [BETA_URL]: () =>
        new Response(
          JSON.stringify({ cli: { latest: '2026.7.0-beta.1', tag: 'v2026.7.0-beta.1', severity: 'normal' } }),
        ),
    });
    const lines = await commandUpgrade(['--channel', 'beta'], baseDeps(fetchFn));
    expect(lines).toEqual(['oh is up to date (2026.7.0, beta channel)']);
    expect(await readCliConfig(configPath)).toEqual({ channel: 'beta' });
  });

  it('rejects unknown channels and stray positionals as usage errors', async () => {
    await expect(commandUpgrade(['--channel', 'nightly'], baseDeps(feedFetch({})))).rejects.toThrow(UsageError);
    await expect(commandUpgrade(['now'], baseDeps(feedFetch({})))).rejects.toThrow(UsageError);
  });

  it('emits the --json shapes', async () => {
    const upgraded = await commandUpgrade(['--json'], baseDeps(feedFetch(stableFeed('oh-2026.7.19-linux-x64'))));
    expect(JSON.parse(upgraded[0])).toEqual({
      status: 'upgraded',
      from: '2026.7.0',
      to: '2026.7.19',
      tag: 'v2026.7.19',
      asset: 'oh-2026.7.19-linux-x64',
      channel: 'stable',
    });
  });

  it('turns an unreachable feed into an operation failure, never a crash', async () => {
    const fetchFn = vi.fn(async () => {
      throw new Error('offline');
    }) as unknown as typeof fetch;
    await expect(commandUpgrade([], baseDeps(fetchFn))).rejects.toThrow(OperationFailedError);
  });
});
