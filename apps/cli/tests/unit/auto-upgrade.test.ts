/**
 * Background self-update trigger — the decide/stamp/spawn half. The
 * child process is a seam here; what's under test is the gate stack
 * (config toggle, ownership, verb exclusions, env kill-switches), the
 * cache-driven trigger, and the per-version daily attempt throttle.
 */

import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { autoUpgradeAttemptPath, maybeSpawnAutoUpgrade } from '../../src/auto-upgrade';
import { updateCheckCachePath } from '../../src/update-check';

let dir: string;
let configPath: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'oh-cli-auto-upgrade-'));
  configPath = path.join(dir, 'openheaders', 'cli.json');
  await mkdir(path.dirname(configPath), { recursive: true });
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

interface SpawnRecord {
  binaryPath: string;
  args: string[];
  env: NodeJS.ProcessEnv;
}

function makeDeps(overrides: Partial<Parameters<typeof maybeSpawnAutoUpgrade>[1]> = {}) {
  const spawns: SpawnRecord[] = [];
  const deps = {
    env: {} as NodeJS.ProcessEnv,
    configPath,
    cliVersion: '2026.7.1',
    execPath: '/opt/openheaders/bin/oh',
    scriptPath: '',
    now: () => 1_752_000_000_000,
    spawnFn: (binaryPath: string, args: string[], env: NodeJS.ProcessEnv) => {
      spawns.push({ binaryPath, args, env });
    },
    ...overrides,
  };
  return { deps, spawns };
}

async function seedCache(latest: string, channel: 'stable' | 'beta' = 'stable'): Promise<void> {
  await writeFile(
    updateCheckCachePath(configPath),
    JSON.stringify({ checkedAt: 1_752_000_000_000, channel, latest, tag: `cli-v${latest}`, severity: 'normal' }),
  );
}

describe('maybeSpawnAutoUpgrade', () => {
  it('spawns a detached upgrade and stamps the attempt when the cache offers newer', async () => {
    await seedCache('2026.8.0');
    const { deps, spawns } = makeDeps();
    const line = await maybeSpawnAutoUpgrade(['status'], deps);
    expect(line).toContain('2026.8.0');
    expect(spawns).toHaveLength(1);
    expect(spawns[0]).toMatchObject({ binaryPath: '/opt/openheaders/bin/oh', args: ['upgrade'] });
    expect(spawns[0]?.env.OH_NO_UPDATE_CHECK).toBe('1');
    const stamp = JSON.parse(await readFile(autoUpgradeAttemptPath(configPath), 'utf8'));
    expect(stamp).toEqual({ version: '2026.8.0', attemptedAt: 1_752_000_000_000 });
  });

  it('spawns at most once per offered version per day, and again after the throttle window', async () => {
    await seedCache('2026.8.0');
    const { deps, spawns } = makeDeps();
    await maybeSpawnAutoUpgrade(['status'], deps);
    expect(await maybeSpawnAutoUpgrade(['status'], deps)).toBeNull();
    expect(spawns).toHaveLength(1);
    const later = makeDeps({ now: () => 1_752_000_000_000 + 25 * 60 * 60 * 1000 });
    expect(await maybeSpawnAutoUpgrade(['status'], later.deps)).not.toBeNull();
    expect(later.spawns).toHaveLength(1);
  });

  it('a NEW offered version bypasses the previous version attempt stamp', async () => {
    await seedCache('2026.8.0');
    const { deps, spawns } = makeDeps();
    await maybeSpawnAutoUpgrade(['status'], deps);
    await seedCache('2026.9.0');
    expect(await maybeSpawnAutoUpgrade(['status'], deps)).toContain('2026.9.0');
    expect(spawns).toHaveLength(2);
  });

  it('stays silent with no cache, an up-to-date cache, or a channel-mismatched cache', async () => {
    const { deps, spawns } = makeDeps();
    expect(await maybeSpawnAutoUpgrade(['status'], deps)).toBeNull();
    await seedCache('2026.7.1');
    expect(await maybeSpawnAutoUpgrade(['status'], deps)).toBeNull();
    await seedCache('2026.8.0', 'beta');
    expect(await maybeSpawnAutoUpgrade(['status'], deps)).toBeNull();
    expect(spawns).toHaveLength(0);
  });

  it('honors the autoUpdate=off config switch', async () => {
    await seedCache('2026.8.0');
    await writeFile(configPath, JSON.stringify({ autoUpdate: false }));
    const { deps, spawns } = makeDeps();
    expect(await maybeSpawnAutoUpgrade(['status'], deps)).toBeNull();
    expect(spawns).toHaveLength(0);
  });

  it('never fires on dev builds, in CI, under OH_NO_UPDATE_CHECK, or for upgrade/autoupdate verbs', async () => {
    await seedCache('2026.8.0');
    const { deps: dev } = makeDeps({ cliVersion: 'dev' });
    expect(await maybeSpawnAutoUpgrade(['status'], dev)).toBeNull();
    const { deps: ci } = makeDeps({ env: { CI: '1' } });
    expect(await maybeSpawnAutoUpgrade(['status'], ci)).toBeNull();
    const { deps: silenced } = makeDeps({ env: { OH_NO_UPDATE_CHECK: '1' } });
    expect(await maybeSpawnAutoUpgrade(['status'], silenced)).toBeNull();
    const { deps, spawns } = makeDeps();
    expect(await maybeSpawnAutoUpgrade(['upgrade'], deps)).toBeNull();
    expect(await maybeSpawnAutoUpgrade(['autoupdate', 'off'], deps)).toBeNull();
    expect(spawns).toHaveLength(0);
  });

  it('never fires on package-manager-owned installs', async () => {
    await seedCache('2026.8.0');
    const { deps: npm, spawns } = makeDeps({ execPath: '/usr/local/bin/node', scriptPath: '/x/node_modules/cli.js' });
    expect(await maybeSpawnAutoUpgrade(['status'], npm)).toBeNull();
    const { deps: brew } = makeDeps({ execPath: '/opt/homebrew/Cellar/oh/1/bin/oh' });
    expect(await maybeSpawnAutoUpgrade(['status'], brew)).toBeNull();
    expect(spawns).toHaveLength(0);
  });

  it('a malformed config or attempt stamp degrades silently', async () => {
    await seedCache('2026.8.0');
    await writeFile(configPath, 'not json');
    const { deps } = makeDeps();
    expect(await maybeSpawnAutoUpgrade(['status'], deps)).toBeNull();
    await rm(configPath);
    await writeFile(autoUpgradeAttemptPath(configPath), 'not json');
    const { deps: junkStamp, spawns } = makeDeps();
    expect(await maybeSpawnAutoUpgrade(['status'], junkStamp)).not.toBeNull();
    expect(spawns).toHaveLength(1);
  });
});
