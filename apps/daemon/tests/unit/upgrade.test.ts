/**
 * `ohd upgrade` — install-kind refusals, the feed → SHA256SUMS →
 * verified-bytes pipeline, the atomic swap, the re-exec probe, and the
 * supervised-restart decision tree (running under a unit / running
 * foreground / stopped / --no-restart).
 */

import { createHash } from 'node:crypto';
import { mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  commandUpgrade,
  detectInstallKind,
  findAssetInSums,
  platformAssetLeg,
  type StageUpgradeDeps,
  stageUpgrade,
} from '../../src/cli/upgrade';

let dir: string;
let binaryPath: string;

const NEW_BYTES = Buffer.from('new ohd binary payload');
const NEW_SHA = createHash('sha256').update(NEW_BYTES).digest('hex');

beforeEach(async () => {
  dir = await realpath(await mkdtemp(path.join(os.tmpdir(), 'ohd-upgrade-')));
  binaryPath = path.join(dir, 'ohd');
  await writeFile(binaryPath, 'old ohd binary payload', { mode: 0o755 });
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const STABLE_URL = 'https://updates.openheaders.com/versions/stable.json';

function feedFetch(byUrl: Record<string, () => Response>): typeof fetch {
  return vi.fn(async (input: RequestInfo | URL) => {
    const handler = byUrl[String(input)];
    if (!handler) throw new Error(`unexpected fetch: ${String(input)}`);
    return handler();
  }) as unknown as typeof fetch;
}

function stableFeed(sha: string = NEW_SHA): Record<string, () => Response> {
  return {
    [STABLE_URL]: () =>
      new Response(JSON.stringify({ daemon: { latest: '2026.7.19', tag: 'v2026.7.19', severity: 'normal' } })),
    'https://updates.openheaders.com/dl/v2026.7.19/SHA256SUMS.txt': () =>
      new Response(
        [
          `${'a'.repeat(64)}  oh-2026.7.19-linux-x64`,
          `${sha}  ohd-2026.7.19-linux-x64`,
          `${'b'.repeat(64)}  ohd-2026.7.19-mac-arm64`,
        ].join('\n'),
      ),
    'https://updates.openheaders.com/dl/v2026.7.19/ohd-2026.7.19-linux-x64': () =>
      new Response(new Uint8Array(NEW_BYTES)),
  };
}

function stageDeps(fetchFn: typeof fetch, overrides: Partial<StageUpgradeDeps> = {}): StageUpgradeDeps {
  return {
    env: {},
    currentVersion: '2026.7.0',
    channel: 'stable',
    fetchFn,
    execPath: binaryPath,
    platform: 'linux',
    arch: 'x64',
    installKind: 'binary',
    probeFn: () => ({ status: 0, stdout: '2026.7.19 (commit abc1234 · build 9)\n' }),
    ...overrides,
  };
}

describe('detectInstallKind', () => {
  it('classifies container over sea, then sea vs node', () => {
    expect(detectInstallKind(true, true)).toBe('container');
    expect(detectInstallKind(true, false)).toBe('binary');
    expect(detectInstallKind(false, false)).toBe('node');
  });
});

describe('platformAssetLeg / findAssetInSums', () => {
  it('maps the release matrix and finds the ohd line only', () => {
    expect(platformAssetLeg('darwin', 'arm64')).toBe('mac-arm64');
    expect(platformAssetLeg('linux', 'x64')).toBe('linux-x64');
    expect(platformAssetLeg('linux', 'arm64')).toBeNull();
    const sums = `${'c'.repeat(64)}  oh-2026.7.19-linux-x64\n${NEW_SHA}  ohd-2026.7.19-linux-x64`;
    expect(findAssetInSums(sums, 'linux-x64')).toEqual({ sha256: NEW_SHA, asset: 'ohd-2026.7.19-linux-x64' });
    expect(findAssetInSums(`${'c'.repeat(64)}  oh-2026.7.19-linux-x64`, 'linux-x64')).toBeNull();
  });
});

describe('stageUpgrade', () => {
  it('refuses node and container installs by ownership', async () => {
    await expect(stageUpgrade(stageDeps(feedFetch({}), { installKind: 'node' }))).rejects.toThrow(/Node distribution/);
    await expect(stageUpgrade(stageDeps(feedFetch({}), { installKind: 'container' }))).rejects.toThrow(
      /container image/,
    );
  });

  it('answers up-to-date without downloading when the feed offers nothing newer', async () => {
    const outcome = await stageUpgrade(stageDeps(feedFetch(stableFeed()), { currentVersion: '2026.7.19' }));
    expect(outcome).toEqual({ status: 'up-to-date', version: '2026.7.19' });
    expect(await readFile(binaryPath, 'utf8')).toBe('old ohd binary payload');
  });

  it('downloads, verifies, swaps atomically, and probes the new binary', async () => {
    const outcome = await stageUpgrade(stageDeps(feedFetch(stableFeed())));
    expect(outcome).toEqual({
      status: 'staged',
      from: '2026.7.0',
      to: '2026.7.19',
      tag: 'v2026.7.19',
      asset: 'ohd-2026.7.19-linux-x64',
    });
    expect(await readFile(binaryPath)).toEqual(NEW_BYTES);
  });

  it('refuses on checksum mismatch and leaves the old binary in place', async () => {
    await expect(stageUpgrade(stageDeps(feedFetch(stableFeed('f'.repeat(64)))))).rejects.toThrow(/checksum mismatch/);
    expect(await readFile(binaryPath, 'utf8')).toBe('old ohd binary payload');
  });

  it('surfaces a failed --version probe after the swap', async () => {
    await expect(
      stageUpgrade(stageDeps(feedFetch(stableFeed()), { probeFn: () => ({ status: 1, stdout: '' }) })),
    ).rejects.toThrow(/probe answered/);
  });
});

describe('commandUpgrade restart decision', () => {
  function commandDeps(overrides: Record<string, unknown> = {}) {
    const lines: string[] = [];
    const restarts: number[] = [];
    const deps = {
      ...stageDeps(feedFetch(stableFeed())),
      channel: 'stable' as const,
      isRunningFn: async () => true,
      unitExistsFn: () => true,
      restartFn: async () => {
        restarts.push(1);
      },
      log: (line: string) => lines.push(line),
      ...overrides,
    };
    return { deps, lines, restarts };
  }

  it('upgrades and restarts a daemon running under the installed unit', async () => {
    const { deps, lines, restarts } = commandDeps();
    await commandUpgrade([], deps);
    expect(lines[0]).toContain('upgraded ohd 2026.7.0 → 2026.7.19');
    expect(restarts).toHaveLength(1);
    expect(lines[1]).toContain('restarted the daemon into 2026.7.19');
  });

  it('--no-restart swaps but leaves the running daemon alone', async () => {
    const { deps, lines, restarts } = commandDeps();
    await commandUpgrade(['--no-restart'], deps);
    expect(restarts).toHaveLength(0);
    expect(lines[1]).toContain('restart to apply');
  });

  it('a stopped daemon gets the swap and an applies-on-next-start note', async () => {
    const { deps, lines, restarts } = commandDeps({ isRunningFn: async () => false });
    await commandUpgrade([], deps);
    expect(restarts).toHaveLength(0);
    expect(lines[1]).toContain('applies on the next start');
  });

  it('a foreground daemon (no unit) is never restarted from under the operator', async () => {
    const { deps, lines, restarts } = commandDeps({ unitExistsFn: () => false });
    await commandUpgrade([], deps);
    expect(restarts).toHaveLength(0);
    expect(lines[1]).toContain('outside the installed service');
  });

  it('rejects a channel outside stable|beta', async () => {
    const { deps } = commandDeps();
    await expect(commandUpgrade(['--channel', 'nightly'], deps)).rejects.toThrow(/usage: ohd upgrade/);
  });
});
