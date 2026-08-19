/**
 * On-start availability notify: env-only gates, the derive-at-print
 * line (never a cached conclusion), the 24h cache, the background
 * refresh that is silent on every failure, and the severity law —
 * loudness keys off the STABLE manifest on both channels.
 */

import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  bootUpdateNotify,
  composeNotifyLine,
  type UpdateCheckCache,
  updateCheckAllowed,
  updateCheckCachePath,
} from '../../src/update-check';

const NOW = 1_800_000_000_000;
const DAY_MS = 24 * 60 * 60 * 1000;

let dir: string;
let configPath: string;
let cachePath: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'oh-cli-update-check-'));
  configPath = path.join(dir, 'openheaders', 'cli.json');
  cachePath = updateCheckCachePath(configPath);
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

function manifestResponse(cli: Record<string, unknown>): Response {
  return new Response(JSON.stringify({ cli }), { status: 200 });
}

function feedFetch(byUrl: Record<string, () => Response | Promise<Response>>): typeof fetch {
  return vi.fn(async (input: RequestInfo | URL) => {
    const handler = byUrl[String(input)];
    if (!handler) throw new Error(`unexpected fetch: ${String(input)}`);
    return handler();
  }) as unknown as typeof fetch;
}

const STABLE_URL = 'https://updates.openheaders.com/versions/stable.json';
const BETA_URL = 'https://updates.openheaders.com/versions/beta.json';

function baseDeps(fetchFn: typeof fetch) {
  return { env: {}, configPath, cliVersion: '2026.7.0', stderrIsTTY: true, fetchFn, now: () => NOW };
}

async function writeCache(cache: UpdateCheckCache): Promise<void> {
  await mkdir(path.dirname(cachePath), { recursive: true });
  await writeFile(cachePath, JSON.stringify(cache));
}

describe('updateCheckAllowed', () => {
  const env = {};

  it('allows a released build on an interactive stderr', () => {
    expect(updateCheckAllowed(['status'], env, true, '2026.7.0')).toBe(true);
  });

  it('gates off dev builds, the escape hatch, CI, non-TTY, --json, and the upgrade verb itself', () => {
    expect(updateCheckAllowed(['status'], env, true, 'dev')).toBe(false);
    expect(updateCheckAllowed(['status'], { OH_NO_UPDATE_CHECK: '1' }, true, '2026.7.0')).toBe(false);
    expect(updateCheckAllowed(['status'], { CI: 'true' }, true, '2026.7.0')).toBe(false);
    expect(updateCheckAllowed(['status'], env, false, '2026.7.0')).toBe(false);
    expect(updateCheckAllowed(['status', '--json'], env, true, '2026.7.0')).toBe(false);
    expect(updateCheckAllowed(['upgrade'], env, true, '2026.7.0')).toBe(false);
  });
});

describe('composeNotifyLine', () => {
  const cache: UpdateCheckCache = {
    checkedAt: NOW,
    channel: 'stable',
    latest: '2026.7.19',
    tag: 'v2026.7.19',
    severity: 'normal',
  };

  it('offers a newer release and stays silent at or above it', () => {
    expect(composeNotifyLine(cache, '2026.7.0')).toBe(
      'oh 2026.7.19 is available (you have 2026.7.0) — run: oh upgrade',
    );
    expect(composeNotifyLine(cache, '2026.7.19')).toBeNull();
    expect(composeNotifyLine(cache, '2026.8.0')).toBeNull();
  });

  it('goes loud only below a security floor', () => {
    const security: UpdateCheckCache = { ...cache, severity: 'security', minimumSafeVersion: '2026.7.10' };
    expect(composeNotifyLine(security, '2026.7.0')).toBe(
      'SECURITY UPDATE: oh 2026.7.19 fixes versions below 2026.7.10 (you have 2026.7.0) — run: oh upgrade',
    );
    expect(composeNotifyLine(security, '2026.7.10')).toBe(
      'oh 2026.7.19 is available (you have 2026.7.10) — run: oh upgrade',
    );
    const betaBelow: UpdateCheckCache = { ...security, minimumSafeVersion: '2026.7.0' };
    expect(composeNotifyLine(betaBelow, '2026.7.0-beta.2')).toContain('SECURITY UPDATE');
  });
});

describe('bootUpdateNotify', () => {
  it('prints from a fresh cache without touching the network', async () => {
    await writeCache({
      checkedAt: NOW - 1000,
      channel: 'stable',
      latest: '2026.7.19',
      tag: 'v2026.7.19',
      severity: 'normal',
    });
    const fetchFn = feedFetch({});
    const notify = await bootUpdateNotify(['status'], baseDeps(fetchFn));
    expect(notify.line).toBe('oh 2026.7.19 is available (you have 2026.7.0) — run: oh upgrade');
    await notify.finish();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('refreshes a stale cache in the background; the next run prints', async () => {
    await writeCache({
      checkedAt: NOW - DAY_MS - 1,
      channel: 'stable',
      latest: '2026.7.18',
      tag: 'v2026.7.18',
      severity: 'normal',
    });
    const fetchFn = feedFetch({
      [STABLE_URL]: () => manifestResponse({ latest: '2026.7.19', tag: 'v2026.7.19', severity: 'normal' }),
    });
    const notify = await bootUpdateNotify(['status'], baseDeps(fetchFn));
    expect(notify.line).toBeNull();
    await notify.finish();
    expect(JSON.parse(await readFile(cachePath, 'utf8'))).toEqual({
      checkedAt: NOW,
      channel: 'stable',
      latest: '2026.7.19',
      tag: 'v2026.7.19',
      severity: 'normal',
    });
    const second = await bootUpdateNotify(['status'], baseDeps(feedFetch({})));
    expect(second.line).toContain('2026.7.19 is available');
  });

  it('on the beta channel offers from beta but takes severity from STABLE', async () => {
    await mkdir(path.dirname(configPath), { recursive: true });
    await writeFile(configPath, JSON.stringify({ channel: 'beta' }));
    const fetchFn = feedFetch({
      [BETA_URL]: () => manifestResponse({ latest: '2026.7.19-beta.1', tag: 'v2026.7.19-beta.1', severity: 'normal' }),
      [STABLE_URL]: () =>
        manifestResponse({
          latest: '2026.7.18',
          tag: 'v2026.7.18',
          severity: 'security',
          minimumSafeVersion: '2026.7.18',
        }),
    });
    const notify = await bootUpdateNotify(['status'], baseDeps(fetchFn));
    await notify.finish();
    expect(JSON.parse(await readFile(cachePath, 'utf8'))).toEqual({
      checkedAt: NOW,
      channel: 'beta',
      latest: '2026.7.19-beta.1',
      tag: 'v2026.7.19-beta.1',
      severity: 'security',
      minimumSafeVersion: '2026.7.18',
    });
  });

  it('a channel switch invalidates the cache instead of printing a stale line', async () => {
    await writeCache({
      checkedAt: NOW - 1000,
      channel: 'beta',
      latest: '2026.7.19-beta.1',
      tag: 'v2026.7.19-beta.1',
      severity: 'normal',
    });
    const fetchFn = feedFetch({
      [STABLE_URL]: () => manifestResponse({ latest: '2026.7.18', tag: 'v2026.7.18', severity: 'normal' }),
    });
    const notify = await bootUpdateNotify(['status'], baseDeps(fetchFn));
    expect(notify.line).toBeNull();
    await notify.finish();
    expect(JSON.parse(await readFile(cachePath, 'utf8'))).toMatchObject({ channel: 'stable', latest: '2026.7.18' });
  });

  it('is silent on network failure and leaves the cache alone', async () => {
    const fetchFn = vi.fn(async () => {
      throw new Error('offline');
    }) as unknown as typeof fetch;
    const notify = await bootUpdateNotify(['status'], baseDeps(fetchFn));
    expect(notify.line).toBeNull();
    await expect(notify.finish()).resolves.toBeUndefined();
    await expect(readFile(cachePath, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('gated-off invocations do no IO at all', async () => {
    const fetchFn = feedFetch({});
    const notify = await bootUpdateNotify(['status'], { ...baseDeps(fetchFn), env: { CI: 'true' } });
    expect(notify.line).toBeNull();
    await notify.finish();
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
