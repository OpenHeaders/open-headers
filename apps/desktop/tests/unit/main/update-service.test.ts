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
import type { SeverityInfo } from '../../../src/main/versions-manifest';

interface Harness {
  service: ReturnType<typeof createUpdateService>;
  broadcasts: AppUpdateState[];
  timers: Array<{ fn: () => void; ms: number }>;
  updater: {
    checkCalls: number;
    downloadCalls: number;
    installCalls: number;
    severityCalls: number;
  };
  setPreferences(next: Partial<UpdatePreferences>): void;
}

function makeHarness(
  overrides: {
    checkResult?: AvailableUpdate | null | Error;
    downloadResult?: Error;
    severityResult?: SeverityInfo | null;
    supported?: boolean;
    preferences?: Partial<UpdatePreferences>;
  } = {},
): Harness {
  const broadcasts: AppUpdateState[] = [];
  const timers: Array<{ fn: () => void; ms: number }> = [];
  const counters = { checkCalls: 0, downloadCalls: 0, installCalls: 0, severityCalls: 0 };
  let prefs: UpdatePreferences = { check: 'all', autoDownload: false, channel: 'stable', ...overrides.preferences };

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
    async fetchSeverity() {
      counters.severityCalls += 1;
      return overrides.severityResult ?? null;
    },
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
  it('defaults to check=all, autoDownload=true, channel=stable on empty/garbage records', () => {
    expect(readUpdatePreferences(undefined)).toEqual({ check: 'all', autoDownload: true, channel: 'stable' });
    expect(
      readUpdatePreferences({ 'updates.check': 42, 'updates.autoDownload': 'yes', 'updates.channel': 'nightly' }),
    ).toEqual({
      check: 'all',
      autoDownload: true,
      channel: 'stable',
    });
  });

  it('reads explicit values', () => {
    expect(
      readUpdatePreferences({ 'updates.check': 'off', 'updates.autoDownload': false, 'updates.channel': 'beta' }),
    ).toEqual({
      check: 'off',
      autoDownload: false,
      channel: 'beta',
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

  it('updateAndRestart from available downloads then installs in one action', async () => {
    const h = makeHarness({ checkResult: { version: '2026.8.0', releaseNotesUrl: null } });
    await h.service.dispatchRpc('oh.updates.checkNow');
    await h.service.dispatchRpc('oh.updates.updateAndRestart');
    expect(h.updater.downloadCalls).toBe(1);
    expect(h.updater.installCalls).toBe(1);
  });

  it('updateAndRestart from downloaded installs immediately without re-downloading', async () => {
    const h = makeHarness({ checkResult: { version: '2026.8.0', releaseNotesUrl: null } });
    await h.service.dispatchRpc('oh.updates.checkNow');
    await h.service.dispatchRpc('oh.updates.download');
    await h.service.dispatchRpc('oh.updates.updateAndRestart');
    expect(h.updater.downloadCalls).toBe(1);
    expect(h.updater.installCalls).toBe(1);
  });

  it('updateAndRestart outside available/downloading/downloaded is a no-op', async () => {
    const h = makeHarness();
    await h.service.dispatchRpc('oh.updates.updateAndRestart');
    expect(h.updater.downloadCalls).toBe(0);
    expect(h.updater.installCalls).toBe(0);
  });

  it('updateAndRestart never installs when the download fails', async () => {
    const h = makeHarness({
      checkResult: { version: '2026.8.0', releaseNotesUrl: null },
      downloadResult: new Error('disk full'),
    });
    await h.service.dispatchRpc('oh.updates.checkNow');
    const state = await h.service.dispatchRpc('oh.updates.updateAndRestart');
    expect(state?.phase).toBe('error');
    expect(h.updater.installCalls).toBe(0);
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

  it('populates severity + belowSafeFloor from the manifest on every check', async () => {
    const h = makeHarness({
      checkResult: { version: '2026.8.0', releaseNotesUrl: null },
      severityResult: { latest: '2026.8.0', severity: 'security', minimumSafeVersion: '2026.8.0' },
    });
    const state = await h.service.dispatchRpc('oh.updates.checkNow');
    expect(state).toMatchObject({ phase: 'available', severity: 'security', belowSafeFloor: true });
    expect(h.updater.severityCalls).toBe(1);
  });

  it('running at or above the safe floor never escalates', async () => {
    const h = makeHarness({
      checkResult: { version: '2026.8.0', releaseNotesUrl: null },
      severityResult: { latest: '2026.8.0', severity: 'security', minimumSafeVersion: '2026.7.0' },
    });
    const state = await h.service.dispatchRpc('oh.updates.checkNow');
    expect(state).toMatchObject({ severity: 'security', belowSafeFloor: false });
  });

  it('an unreachable manifest leaves severity unknown and the feed check unaffected', async () => {
    const h = makeHarness({
      checkResult: { version: '2026.8.0', releaseNotesUrl: null },
      severityResult: null,
    });
    const state = await h.service.dispatchRpc('oh.updates.checkNow');
    expect(state).toMatchObject({ phase: 'available', severity: null, belowSafeFloor: false });
  });

  it('security-only scheduled check without exposure skips the feed and ends idle silently', async () => {
    const h = makeHarness({
      checkResult: { version: '2026.8.0', releaseNotesUrl: null },
      severityResult: { latest: '2026.8.0', severity: 'normal' },
      preferences: { check: 'security-only' },
    });
    h.service.start();
    h.timers[0]?.fn();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(h.updater.severityCalls).toBe(1);
    expect(h.updater.checkCalls).toBe(0);
    expect(h.service.state()).toMatchObject({
      phase: 'idle',
      availableVersion: null,
      severity: 'normal',
      lastCheckedAt: 1_752_000_000_000,
    });
    // The next daily check is still armed.
    expect(h.timers).toHaveLength(2);
  });

  it('security-only scheduled check below the floor runs the feed check', async () => {
    const h = makeHarness({
      checkResult: { version: '2026.8.0', releaseNotesUrl: null },
      severityResult: { latest: '2026.8.0', severity: 'security', minimumSafeVersion: '2026.8.0' },
      preferences: { check: 'security-only' },
    });
    h.service.start();
    h.timers[0]?.fn();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(h.updater.checkCalls).toBe(1);
    expect(h.service.state()).toMatchObject({
      phase: 'available',
      availableVersion: '2026.8.0',
      belowSafeFloor: true,
    });
  });

  it('security-only manual check always runs the feed check', async () => {
    const h = makeHarness({
      checkResult: { version: '2026.8.0', releaseNotesUrl: null },
      severityResult: { latest: '2026.8.0', severity: 'normal' },
      preferences: { check: 'security-only' },
    });
    const state = await h.service.dispatchRpc('oh.updates.checkNow');
    expect(h.updater.checkCalls).toBe(1);
    expect(state).toMatchObject({ phase: 'available', availableVersion: '2026.8.0', belowSafeFloor: false });
  });

  it('non-updates RPC types fall through as undefined', async () => {
    const h = makeHarness();
    expect(await h.service.dispatchRpc('oh.sync.snapshot')).toBeUndefined();
    expect(await h.service.dispatchRpc(undefined)).toBeUndefined();
  });
});
