import type { AppUpdateState } from '@openheaders/core/bridge';
import { describe, expect, it } from 'vitest';
import {
  type AvailableUpdate,
  createUpdateService,
  readUpdatePreferences,
  type UpdatePreferences,
  type UpdaterPort,
  type UpdateServiceDeps,
} from '../../../src/main/update-service';

interface Harness {
  service: ReturnType<typeof createUpdateService>;
  broadcasts: AppUpdateState[];
  timers: Array<{ fn: () => void; ms: number }>;
  updater: {
    checkCalls: number;
    downloadCalls: number;
    installCalls: number;
  };
  setPreferences(next: Partial<UpdatePreferences>): void;
}

function makeHarness(
  overrides: {
    checkResult?: AvailableUpdate | null | Error;
    downloadResult?: Error;
    supported?: boolean;
    preferences?: Partial<UpdatePreferences>;
  } = {},
): Harness {
  const broadcasts: AppUpdateState[] = [];
  const timers: Array<{ fn: () => void; ms: number }> = [];
  const counters = { checkCalls: 0, downloadCalls: 0, installCalls: 0 };
  let prefs: UpdatePreferences = { check: 'all', autoDownload: false, ...overrides.preferences };

  const updater: UpdaterPort = {
    async check() {
      counters.checkCalls += 1;
      const result = overrides.checkResult ?? null;
      if (result instanceof Error) throw result;
      return result;
    },
    async download(onProgress) {
      counters.downloadCalls += 1;
      if (overrides.downloadResult) throw overrides.downloadResult;
      onProgress(30);
      onProgress(30.4); // same integer percent — must not re-broadcast
      onProgress(100);
    },
    quitAndInstall() {
      counters.installCalls += 1;
    },
  };

  const deps: UpdateServiceDeps = {
    updater,
    currentVersion: '2026.7.2',
    supported: overrides.supported ?? true,
    getPreferences: () => prefs,
    broadcast: (state) => broadcasts.push(state),
    now: () => 1_752_000_000_000,
    setTimer: (fn, ms) => {
      timers.push({ fn, ms });
      return timers.length as unknown as NodeJS.Timeout;
    },
    clearTimer: () => {},
    log: { info: () => {}, warn: () => {} },
  };

  return {
    service: createUpdateService(deps),
    broadcasts,
    timers,
    updater: counters,
    setPreferences: (next) => {
      prefs = { ...prefs, ...next };
    },
  };
}

describe('readUpdatePreferences', () => {
  it('defaults to check=all, autoDownload=false on empty/garbage records', () => {
    expect(readUpdatePreferences(undefined)).toEqual({ check: 'all', autoDownload: false });
    expect(readUpdatePreferences({ 'updates.check': 42, 'updates.autoDownload': 'yes' })).toEqual({
      check: 'all',
      autoDownload: false,
    });
  });

  it('reads explicit values', () => {
    expect(readUpdatePreferences({ 'updates.check': 'off', 'updates.autoDownload': true })).toEqual({
      check: 'off',
      autoDownload: true,
    });
    expect(readUpdatePreferences({ 'updates.check': 'security-only' }).check).toBe('security-only');
  });
});

describe('update service state machine', () => {
  it('starts idle with the current version and support flag', () => {
    const h = makeHarness();
    expect(h.service.state()).toMatchObject({
      phase: 'idle',
      currentVersion: '2026.7.2',
      availableVersion: null,
      lastCheckReason: null,
      supported: true,
    });
  });

  it('manual check finding an update lands in available and stamps lastCheckedAt', async () => {
    const h = makeHarness({ checkResult: { version: '2026.8.0', releaseNotesUrl: null } });
    const state = await h.service.dispatchRpc('oh.updates.checkNow');
    expect(state).toMatchObject({
      phase: 'available',
      availableVersion: '2026.8.0',
      lastCheckedAt: 1_752_000_000_000,
      lastCheckReason: 'manual',
    });
    expect(h.broadcasts.map((b) => b.phase)).toEqual(['checking', 'available']);
  });

  it('manual check with nothing newer returns to idle', async () => {
    const h = makeHarness({ checkResult: null });
    const state = await h.service.dispatchRpc('oh.updates.checkNow');
    expect(state).toMatchObject({ phase: 'idle', availableVersion: null, lastCheckReason: 'manual' });
  });

  it('check failure lands in error with the message', async () => {
    const h = makeHarness({ checkResult: new Error('feed unreachable') });
    const state = await h.service.dispatchRpc('oh.updates.checkNow');
    expect(state).toMatchObject({ phase: 'error', errorMessage: 'feed unreachable' });
  });

  it('download runs only from available, dedupes progress by integer percent, ends downloaded', async () => {
    const h = makeHarness({ checkResult: { version: '2026.8.0', releaseNotesUrl: null } });
    expect((await h.service.dispatchRpc('oh.updates.download'))?.phase).toBe('idle');
    expect(h.updater.downloadCalls).toBe(0);

    await h.service.dispatchRpc('oh.updates.checkNow');
    const state = await h.service.dispatchRpc('oh.updates.download');
    expect(state).toMatchObject({ phase: 'downloaded', progressPercent: 100 });
    const percents = h.broadcasts.filter((b) => b.phase === 'downloading').map((b) => b.progressPercent);
    expect(percents).toEqual([0, 30, 100]);
  });

  it('autoDownload=on flows check straight through to downloaded', async () => {
    const h = makeHarness({
      checkResult: { version: '2026.8.0', releaseNotesUrl: null },
      preferences: { autoDownload: true },
    });
    const state = await h.service.dispatchRpc('oh.updates.checkNow');
    expect(state?.phase).toBe('downloaded');
    expect(h.updater.downloadCalls).toBe(1);
  });

  it('install fires only from downloaded', async () => {
    const h = makeHarness({
      checkResult: { version: '2026.8.0', releaseNotesUrl: null },
      preferences: { autoDownload: true },
    });
    await h.service.dispatchRpc('oh.updates.install');
    expect(h.updater.installCalls).toBe(0);
    await h.service.dispatchRpc('oh.updates.checkNow');
    await h.service.dispatchRpc('oh.updates.install');
    expect(h.updater.installCalls).toBe(1);
  });

  it('never checks when unsupported, and getState still answers', async () => {
    const h = makeHarness({ supported: false });
    const state = await h.service.dispatchRpc('oh.updates.checkNow');
    expect(state?.phase).toBe('idle');
    expect(h.updater.checkCalls).toBe(0);
    expect((await h.service.dispatchRpc('oh.updates.getState'))?.supported).toBe(false);
  });

  it('start() schedules nothing when checks are off; preferencesChanged arms it later', () => {
    const h = makeHarness({ preferences: { check: 'off' } });
    h.service.start();
    expect(h.timers).toHaveLength(0);
    h.setPreferences({ check: 'all' });
    h.service.preferencesChanged();
    expect(h.timers).toHaveLength(1);
    expect(h.timers[0]?.ms).toBeGreaterThanOrEqual(60_000);
  });

  it('scheduled check skips when the setting flipped off after arming', async () => {
    const h = makeHarness({ checkResult: { version: '2026.8.0', releaseNotesUrl: null } });
    h.service.start();
    expect(h.timers).toHaveLength(1);
    h.setPreferences({ check: 'off' });
    h.timers[0]?.fn();
    await Promise.resolve();
    expect(h.updater.checkCalls).toBe(0);
    expect(h.service.state().phase).toBe('idle');
  });

  it('non-updates RPC types fall through as undefined', async () => {
    const h = makeHarness();
    expect(await h.service.dispatchRpc('oh.sync.snapshot')).toBeUndefined();
    expect(await h.service.dispatchRpc(undefined)).toBeUndefined();
  });
});
