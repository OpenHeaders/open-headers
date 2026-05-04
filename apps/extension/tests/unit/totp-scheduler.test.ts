import type { V5 } from '@openheaders/core/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// `chrome.alarms` lives on the global mock — we drive it directly.
const alarmCreate = vi.fn();
const alarmClear = vi.fn(() => Promise.resolve(true));

vi.stubGlobal('chrome', {
  ...(globalThis as unknown as { chrome?: typeof chrome }).chrome,
  alarms: {
    create: alarmCreate,
    clear: alarmClear,
  },
});

// Capture environment-store change listeners so we can fire them ourselves.
type ChangeListener = () => void;
const envListeners: ChangeListener[] = [];
let mockVault: V5.Vault = { schemaVersion: 5, secrets: [] };

vi.mock('@/background/modules/environment-store', () => ({
  getVault: vi.fn(() => mockVault),
  onEnvironmentStoreChange: (fn: ChangeListener) => {
    envListeners.push(fn);
    return () => {
      const i = envListeners.indexOf(fn);
      if (i >= 0) envListeners.splice(i, 1);
    };
  },
}));

import {
  __resetForTests,
  bootstrapTotpScheduler,
  getCachedTotpCodes,
  handleTotpAlarm,
  isTotpAlarm,
  refreshCachedTotpCodes,
} from '@/background/modules/totp-scheduler';

// RFC 6238 SHA1 reference vector — base32 of "12345678901234567890",
// at t=59s the 6-digit code is 287082. Pin "now" so the test is
// deterministic across runs.
const REF_SEED = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
const REF_T_MS = 59 * 1000;

let totpUidCounter = 0;
function totpEntry(name: string, overrides: Partial<V5.VaultSecretTotp> = {}): V5.VaultSecretTotp {
  totpUidCounter += 1;
  return {
    uid: `sctotp${totpUidCounter.toString().padStart(2, '0')}`,
    kind: 'totp',
    name,
    seed: REF_SEED,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    ...overrides,
  };
}

let stringUidCounter = 0;
function stringEntry(name: string, value: string): V5.VaultSecretString {
  stringUidCounter += 1;
  return { uid: `scstrx${stringUidCounter.toString().padStart(2, '0')}`, kind: 'string', name, value };
}

beforeEach(() => {
  __resetForTests();
  alarmCreate.mockReset();
  alarmClear.mockReset().mockResolvedValue(true);
  envListeners.length = 0;
  mockVault = { schemaVersion: 5, secrets: [] };
  vi.useFakeTimers();
  vi.setSystemTime(new Date(REF_T_MS));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('totp-scheduler — cache', () => {
  it('starts empty until bootstrap lands its first refresh', async () => {
    expect(getCachedTotpCodes().size).toBe(0);
  });

  it('bootstrap populates the cache from the current vault', async () => {
    mockVault = { schemaVersion: 5, secrets: [totpEntry('GitHubTOTP')] };
    const onTick = vi.fn();
    await bootstrapTotpScheduler(onTick);
    expect(getCachedTotpCodes().get('GitHubTOTP')).toBe('287082');
  });

  it('bootstrap with no TOTP entries leaves the cache empty AND skips the alarm', async () => {
    mockVault = { schemaVersion: 5, secrets: [stringEntry('TOKEN', 'abc')] };
    await bootstrapTotpScheduler(vi.fn());
    expect(getCachedTotpCodes().size).toBe(0);
    expect(alarmCreate).not.toHaveBeenCalled();
  });

  it('survives a TOTP entry with a malformed seed — logs + skips that entry', async () => {
    mockVault = {
      schemaVersion: 5,
      
      secrets: [totpEntry('Good'), totpEntry('Bad', { seed: '!!!INVALID!!!' })],
    };
    await bootstrapTotpScheduler(vi.fn());
    expect(getCachedTotpCodes().get('Good')).toBe('287082');
    expect(getCachedTotpCodes().has('Bad')).toBe(false);
  });
});

describe('totp-scheduler — alarm scheduling', () => {
  it('schedules a one-shot alarm at the next 30s window-flip + guardband', async () => {
    mockVault = { schemaVersion: 5, secrets: [totpEntry('A')] };
    await bootstrapTotpScheduler(vi.fn());
    // At t=59s, next 30s flip is t=60s. Guardband = 250ms → fire at t=60.25s.
    // Uses absolute `when:` so dev/unpacked builds fire at the exact flip
    // moment (no artificial 30s clamp); production builds apply Chrome's
    // own per-extension minimum if any.
    expect(alarmCreate).toHaveBeenCalledWith('oh-totp-tick', expect.objectContaining({ when: 60_250 }));
  });

  it('schedules to the SOONEST flip when entries have different periods', async () => {
    vi.setSystemTime(new Date(45_000));
    mockVault = {
      schemaVersion: 5,
      
      secrets: [totpEntry('Fast', { period: 30 }), totpEntry('Slow', { period: 60 })],
    };
    await bootstrapTotpScheduler(vi.fn());
    // 30s entry: next flip at t=60. 60s entry: next flip at t=60. Min = t=60.
    // Guardband 250ms → fire at t=60.25s.
    expect(alarmCreate).toHaveBeenCalledWith('oh-totp-tick', expect.objectContaining({ when: 60_250 }));
  });

  it('clears any prior alarm before scheduling a new one', async () => {
    mockVault = { schemaVersion: 5, secrets: [totpEntry('A')] };
    await bootstrapTotpScheduler(vi.fn());
    expect(alarmClear).toHaveBeenCalledWith('oh-totp-tick');
  });
});

describe('totp-scheduler — handleTotpAlarm', () => {
  it('refreshes codes + signals onTick + reschedules the next alarm', async () => {
    mockVault = { schemaVersion: 5, secrets: [totpEntry('A')] };
    const onTick = vi.fn();
    await bootstrapTotpScheduler(onTick);
    onTick.mockClear();
    alarmCreate.mockClear();
    // Advance the clock to the next window so the recompute lands a
    // different code than the initial bootstrap.
    vi.setSystemTime(new Date(60 * 1000));
    await handleTotpAlarm();
    // SHA1 / 6 digits / period=30 / t=60s — different window than the
    // bootstrap pass at t=59s, so the cache MUST advance to the new code.
    expect(getCachedTotpCodes().get('A')).toBe('359152');
    expect(onTick).toHaveBeenCalledTimes(1);
    expect(alarmCreate).toHaveBeenCalledTimes(1); // next flip rescheduled
  });
});

describe('totp-scheduler — vault-change reschedule', () => {
  it('reschedules the alarm when a TOTP entry is added (no implicit refresh)', async () => {
    await bootstrapTotpScheduler(vi.fn());
    expect(alarmCreate).not.toHaveBeenCalled(); // no TOTP entries yet
    alarmCreate.mockClear();

    mockVault = { schemaVersion: 5, secrets: [totpEntry('NewEntry')] };
    for (const fn of envListeners) fn();
    await vi.waitFor(() => expect(alarmCreate).toHaveBeenCalledTimes(1));
    // Refresh is the COMPILE-PATH's job via `refreshCachedTotpCodes`,
    // NOT the listener's. The cache stays untouched until the next
    // compile (or alarm tick) requests a refresh.
    expect(getCachedTotpCodes().has('NewEntry')).toBe(false);
  });

  it('cancels the alarm when the last TOTP entry is removed', async () => {
    mockVault = { schemaVersion: 5, secrets: [totpEntry('A')] };
    await bootstrapTotpScheduler(vi.fn());
    alarmClear.mockClear();
    alarmCreate.mockClear();

    mockVault = { schemaVersion: 5, secrets: [] };
    for (const fn of envListeners) fn();
    // The listener kicks an async `scheduleNextFlip()` — wait for it.
    await vi.waitFor(() => expect(alarmClear).toHaveBeenCalledWith('oh-totp-tick'));
    // No alarm rescheduled when there are zero TOTP entries.
    expect(alarmCreate).not.toHaveBeenCalled();
  });
});

describe('totp-scheduler — refreshCachedTotpCodes (compile-path entry)', () => {
  it('recomputes the cache against the current vault — closes the listener race', async () => {
    // Simulate the bug scenario: vault has TOTP entry, but the cache
    // is empty (e.g., fresh SW boot mid-compile, or a vault edit that
    // beat the listener-driven refresh). The compile-path entry
    // populates the cache so the resolver reads current codes.
    mockVault = { schemaVersion: 5, secrets: [totpEntry('A')] };
    expect(getCachedTotpCodes().size).toBe(0);
    await refreshCachedTotpCodes();
    expect(getCachedTotpCodes().get('A')).toBe('287082');
  });

  it('clears the cache when every TOTP entry has been removed', async () => {
    mockVault = { schemaVersion: 5, secrets: [totpEntry('A')] };
    await refreshCachedTotpCodes();
    expect(getCachedTotpCodes().get('A')).toBe('287082');
    mockVault = { schemaVersion: 5, secrets: [] };
    await refreshCachedTotpCodes();
    expect(getCachedTotpCodes().size).toBe(0);
  });
});

describe('totp-scheduler — alarm-name routing', () => {
  it('isTotpAlarm matches the scheduler alarm by exact name', () => {
    expect(isTotpAlarm({ name: 'oh-totp-tick' } as chrome.alarms.Alarm)).toBe(true);
    expect(isTotpAlarm({ name: 'oh-live-anything' } as chrome.alarms.Alarm)).toBe(false);
    expect(isTotpAlarm({ name: '' } as chrome.alarms.Alarm)).toBe(false);
  });
});
