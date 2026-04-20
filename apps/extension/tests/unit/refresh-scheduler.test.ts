/**
 * Phase H — shared `RefreshScheduler` + alarm-name codec. The two
 * subsystem-specific schedulers (`oauth-refresh-scheduler`,
 * `live-refresh-scheduler`) now delegate to this module; these tests
 * cover the shared primitives in isolation so subsystem tests only
 * need to cover their own cadence / gate / dispatch logic.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const alarmsCreateMock = vi.fn<(name: string, info: chrome.alarms.AlarmCreateInfo) => void>();
const alarmsClearMock = vi.fn<(name: string) => void>();
const alarmsGetAllMock = vi.fn<() => Promise<chrome.alarms.Alarm[]>>();

vi.mock('@utils/browser-api', () => ({
  alarms: {
    create: (name: string, info: chrome.alarms.AlarmCreateInfo) => alarmsCreateMock(name, info),
    clear: (name: string) => alarmsClearMock(name),
    getAll: () => alarmsGetAllMock(),
    onAlarm: { addListener: vi.fn(), removeListener: vi.fn() },
  },
}));

vi.mock('@utils/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// Import AFTER mocks so @utils/browser-api resolves to the shim above.
import {
  base64UrlDecode,
  base64UrlEncode,
  createAlarmNameCodec,
  type RefreshProvider,
  RefreshScheduler,
} from '@/background/modules/refresh-scheduler';

// ── base64url ──────────────────────────────────────────────────────

describe('base64url codec', () => {
  it('round-trips ASCII', () => {
    expect(base64UrlDecode(base64UrlEncode('hello world'))).toBe('hello world');
  });

  it('round-trips UTF-8 multi-byte', () => {
    const s = 'öäü 日本語 🚀';
    expect(base64UrlDecode(base64UrlEncode(s))).toBe(s);
  });

  it('round-trips JSON envelopes (the schedulers` identity shape)', () => {
    const payload = { w: 'ws-1', r: 'cred:with:colons and spaces/slashes' };
    const encoded = base64UrlEncode(JSON.stringify(payload));
    expect(JSON.parse(base64UrlDecode(encoded))).toEqual(payload);
  });

  it('uses URL-safe alphabet (no +, /, or padding)', () => {
    const out = base64UrlEncode('>>?<<');
    expect(out).not.toMatch(/[+/=]/);
  });
});

// ── createAlarmNameCodec ──────────────────────────────────────────

describe('createAlarmNameCodec', () => {
  interface Payload {
    w: string;
    u: string;
  }
  const isValid = (p: unknown): p is Payload =>
    !!p &&
    typeof p === 'object' &&
    typeof (p as { w?: unknown }).w === 'string' &&
    typeof (p as { u?: unknown }).u === 'string';
  const codec = createAlarmNameCodec<Payload>('test:', isValid);

  it('encode + decode round-trip preserves identity', () => {
    const name = codec.encode({ w: 'ws-1', u: 'uid-2' });
    expect(name.startsWith('test:')).toBe(true);
    expect(codec.decode(name)).toEqual({ w: 'ws-1', u: 'uid-2' });
  });

  it('matches returns true only for its own prefix', () => {
    const name = codec.encode({ w: 'x', u: 'y' });
    expect(codec.matches(name)).toBe(true);
    expect(codec.matches('other-prefix:foo')).toBe(false);
  });

  it('decode returns null for foreign-prefix names', () => {
    expect(codec.decode('oauth-refresh:whatever')).toBeNull();
    expect(codec.decode('live-refresh:whatever')).toBeNull();
  });

  it('decode returns null for malformed payloads', () => {
    const bogus = `test:${base64UrlEncode(JSON.stringify({ w: 'x' }))}`; // missing u
    expect(codec.decode(bogus)).toBeNull();
    const garbage = 'test:not-valid-base64!!!';
    expect(codec.decode(garbage)).toBeNull();
  });
});

// ── RefreshScheduler class ────────────────────────────────────────

interface Job {
  id: string;
  scheduleAt: number | null;
  eligible: boolean;
}

interface Payload {
  id: string;
}

interface TestProvider extends RefreshProvider<Payload, Job, { attempt: number }> {
  __setJobs: (next: Job[]) => void;
  __fire: () => void;
  __listenerCount: () => number;
  __hooks: {
    fired: ReturnType<typeof vi.fn>;
    succeeded: ReturnType<typeof vi.fn>;
    failed: ReturnType<typeof vi.fn>;
    refresh: ReturnType<typeof vi.fn>;
    recordFailure: ReturnType<typeof vi.fn>;
  };
}

function makeProvider(initial: Job[]): TestProvider {
  let jobs = [...initial];
  const listeners = new Set<() => void>();
  const fired = vi.fn<(payload: Payload) => void>();
  const succeeded = vi.fn<(payload: Payload) => void>();
  const failed = vi.fn<(payload: Payload, err: Error, state: { attempt: number }) => void>();
  const refresh = vi.fn<(job: Job) => Promise<void>>(() => Promise.resolve());
  const recordFailure = vi.fn<(payload: Payload) => Promise<{ attempt: number }>>(() =>
    Promise.resolve({ attempt: 1 }),
  );
  const codec = createAlarmNameCodec<Payload>(
    'rs-test:',
    (p): p is Payload => !!p && typeof p === 'object' && typeof (p as { id?: unknown }).id === 'string',
  );
  const provider: RefreshProvider<Payload, Job, { attempt: number }> = {
    alarmPrefix: 'rs-test:',
    decodeAlarm: (name) => codec.decode(name),
    encodeAlarm: (job) => codec.encode({ id: job.id }),
    encodeAlarmFromPayload: (payload) => codec.encode(payload),
    listAll: async () => jobs,
    getByAlarm: async (payload) => jobs.find((j) => j.id === payload.id) ?? null,
    computeNextFireAt: (job) => job.scheduleAt,
    canSchedule: (job) => job.eligible,
    refresh,
    recordFailure,
    onStoreChange(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    onFired: fired,
    onSucceeded: succeeded,
    onFailed: failed,
  };
  return Object.assign(provider, {
    __setJobs: (next: Job[]) => {
      jobs = next;
    },
    __fire: () => {
      for (const l of listeners) l();
    },
    __listenerCount: () => listeners.size,
    __hooks: { fired, succeeded, failed, refresh, recordFailure },
  }) as TestProvider;
}

beforeEach(() => {
  alarmsCreateMock.mockClear();
  alarmsClearMock.mockClear();
  alarmsGetAllMock.mockReset();
  alarmsGetAllMock.mockResolvedValue([]);
});

afterEach(() => {
  // No global state — each test builds its own provider + scheduler.
});

describe('RefreshScheduler.schedule', () => {
  it('creates an alarm when canSchedule=true AND cadence returns a value', async () => {
    const provider = makeProvider([]);
    const scheduler = new RefreshScheduler(provider, 'TestScheduler');
    await scheduler.schedule({ id: 'j1', scheduleAt: 1_700_000_000_000, eligible: true });
    expect(alarmsCreateMock).toHaveBeenCalledTimes(1);
    expect(alarmsCreateMock.mock.calls[0][1]).toEqual({ when: 1_700_000_000_000 });
  });

  it('clears a stale alarm when canSchedule=false (ineligible)', async () => {
    const provider = makeProvider([]);
    const scheduler = new RefreshScheduler(provider, 'TestScheduler');
    const ok = await scheduler.schedule({ id: 'j1', scheduleAt: 1_700_000_000_000, eligible: false });
    expect(ok).toBe(false);
    expect(alarmsCreateMock).not.toHaveBeenCalled();
    expect(alarmsClearMock).toHaveBeenCalledTimes(1);
  });

  it('clears a stale alarm when cadence returns null', async () => {
    const provider = makeProvider([]);
    const scheduler = new RefreshScheduler(provider, 'TestScheduler');
    const ok = await scheduler.schedule({ id: 'j1', scheduleAt: null, eligible: true });
    expect(ok).toBe(false);
    expect(alarmsClearMock).toHaveBeenCalledTimes(1);
  });
});

describe('RefreshScheduler.reconcile', () => {
  it('schedules every eligible job and clears orphan alarms with our prefix', async () => {
    const provider = makeProvider([
      { id: 'a', scheduleAt: 1_000, eligible: true },
      { id: 'b', scheduleAt: 2_000, eligible: true },
    ]);
    const scheduler = new RefreshScheduler(provider, 'TestScheduler');
    // Existing alarms: two of ours (one no longer wanted), one foreign.
    alarmsGetAllMock.mockResolvedValue([
      { name: provider.encodeAlarm({ id: 'a', scheduleAt: 0, eligible: true }) } as chrome.alarms.Alarm,
      { name: provider.encodeAlarm({ id: 'zombie', scheduleAt: 0, eligible: true }) } as chrome.alarms.Alarm,
      { name: 'oauth-refresh:foreign' } as chrome.alarms.Alarm,
    ]);
    await scheduler.reconcile();
    expect(alarmsCreateMock).toHaveBeenCalledTimes(2);
    // Orphan (our-prefix but no longer in listAll) cleared:
    const clearedNames = alarmsClearMock.mock.calls.map((c) => c[0]);
    expect(clearedNames).toContain(provider.encodeAlarm({ id: 'zombie', scheduleAt: 0, eligible: true }));
    // Foreign prefix LEFT ALONE:
    expect(clearedNames).not.toContain('oauth-refresh:foreign');
  });
});

describe('RefreshScheduler.handleAlarm', () => {
  it('fires → refreshes → succeeds on the happy path', async () => {
    const provider = makeProvider([{ id: 'j1', scheduleAt: 1_000, eligible: true }]);
    const scheduler = new RefreshScheduler(provider, 'TestScheduler');
    await scheduler.handleAlarm({
      name: provider.encodeAlarm({ id: 'j1', scheduleAt: 0, eligible: true }),
    } as chrome.alarms.Alarm);
    expect(provider.__hooks.fired).toHaveBeenCalledTimes(1);
    expect(provider.__hooks.refresh).toHaveBeenCalledTimes(1);
    expect(provider.__hooks.succeeded).toHaveBeenCalledTimes(1);
    expect(provider.__hooks.failed).not.toHaveBeenCalled();
  });

  it('routes to onFailed + recordFailure when refresh throws', async () => {
    const provider = makeProvider([{ id: 'j1', scheduleAt: 1_000, eligible: true }]);
    provider.__hooks.refresh.mockRejectedValue(new Error('boom'));
    const scheduler = new RefreshScheduler(provider, 'TestScheduler');
    await scheduler.handleAlarm({
      name: provider.encodeAlarm({ id: 'j1', scheduleAt: 0, eligible: true }),
    } as chrome.alarms.Alarm);
    expect(provider.__hooks.failed).toHaveBeenCalledTimes(1);
    expect(provider.__hooks.succeeded).not.toHaveBeenCalled();
    expect(provider.__hooks.recordFailure).toHaveBeenCalledTimes(1);
  });

  it('ignores alarms with a foreign prefix', async () => {
    const provider = makeProvider([{ id: 'j1', scheduleAt: 1_000, eligible: true }]);
    const scheduler = new RefreshScheduler(provider, 'TestScheduler');
    await scheduler.handleAlarm({ name: 'oauth-refresh:foreign' } as chrome.alarms.Alarm);
    expect(provider.__hooks.fired).not.toHaveBeenCalled();
  });

  it('clears the alarm when the job no longer exists (race with delete)', async () => {
    const provider = makeProvider([]);
    const scheduler = new RefreshScheduler(provider, 'TestScheduler');
    const name = provider.encodeAlarm({ id: 'gone', scheduleAt: 0, eligible: true });
    await scheduler.handleAlarm({ name } as chrome.alarms.Alarm);
    expect(alarmsClearMock).toHaveBeenCalledWith(name);
    expect(provider.__hooks.refresh).not.toHaveBeenCalled();
  });

  it('clears the alarm when canSchedule flips false between schedule and fire', async () => {
    const provider = makeProvider([{ id: 'j1', scheduleAt: 1_000, eligible: false }]);
    const scheduler = new RefreshScheduler(provider, 'TestScheduler');
    const name = provider.encodeAlarm({ id: 'j1', scheduleAt: 0, eligible: true });
    await scheduler.handleAlarm({ name } as chrome.alarms.Alarm);
    expect(alarmsClearMock).toHaveBeenCalledWith(name);
    expect(provider.__hooks.refresh).not.toHaveBeenCalled();
  });
});

describe('RefreshScheduler.start / stop', () => {
  it('subscribes exactly once (idempotent); stop unsubscribes', () => {
    const provider = makeProvider([]);
    const scheduler = new RefreshScheduler(provider, 'TestScheduler');
    scheduler.start();
    scheduler.start();
    expect(provider.__listenerCount()).toBe(1);
    scheduler.stop();
    expect(provider.__listenerCount()).toBe(0);
  });

  it('re-start after stop creates a fresh subscription', () => {
    const provider = makeProvider([]);
    const scheduler = new RefreshScheduler(provider, 'TestScheduler');
    scheduler.start();
    scheduler.stop();
    scheduler.start();
    expect(provider.__listenerCount()).toBe(1);
    scheduler.stop();
  });
});
