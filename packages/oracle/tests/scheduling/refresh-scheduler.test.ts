/**
 * Host-neutral `RefreshScheduler` core + key codec. The subsystem
 * schedulers (extension `oauth-refresh-scheduler` /
 * `live-refresh-scheduler`, desktop `live-refresh-scheduler`) delegate
 * to this module; these tests cover the shared primitives in isolation
 * against a fake `RefreshTimer`, so subsystem tests only need to cover
 * their own cadence / gate / dispatch logic under their host's timer
 * adapter.
 */

import { describe, expect, it, vi } from 'vitest';
import {
  base64UrlDecode,
  base64UrlEncode,
  createKeyCodec,
  type RefreshProvider,
  RefreshScheduler,
  type RefreshTimer,
} from '../../src/scheduling';

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

// ── createKeyCodec ────────────────────────────────────────────────

describe('createKeyCodec', () => {
  interface Payload {
    w: string;
    u: string;
  }
  const isValid = (p: unknown): p is Payload =>
    !!p &&
    typeof p === 'object' &&
    typeof (p as { w?: unknown }).w === 'string' &&
    typeof (p as { u?: unknown }).u === 'string';
  const codec = createKeyCodec<Payload>('test:', isValid);

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

// ── Fake timer (the port under test) ──────────────────────────────

interface FakeTimer extends RefreshTimer {
  armed: Map<string, number>;
  armCalls: Array<[string, number]>;
  cancelCalls: string[];
  /** Extra keys `listArmed` reports beyond the armed map (foreign owners). */
  externallyArmed: string[];
}

function makeTimer(opts: { available?: boolean } = {}): FakeTimer {
  const armed = new Map<string, number>();
  const armCalls: Array<[string, number]> = [];
  const cancelCalls: string[] = [];
  const externallyArmed: string[] = [];
  return {
    available: opts.available ?? true,
    armed,
    armCalls,
    cancelCalls,
    externallyArmed,
    arm(key, atMs) {
      armed.set(key, atMs);
      armCalls.push([key, atMs]);
    },
    cancel(key) {
      armed.delete(key);
      cancelCalls.push(key);
    },
    async listArmed() {
      return [...armed.keys(), ...externallyArmed];
    },
  };
}

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

const codec = createKeyCodec<Payload>(
  'rs-test:',
  (p): p is Payload => !!p && typeof p === 'object' && typeof (p as { id?: unknown }).id === 'string',
);

function keyOf(id: string): string {
  return codec.encode({ id });
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
  const provider: RefreshProvider<Payload, Job, { attempt: number }> = {
    keyPrefix: 'rs-test:',
    decodeKey: (name) => codec.decode(name),
    encodeKey: (job) => codec.encode({ id: job.id }),
    encodeKeyFromPayload: (payload) => codec.encode(payload),
    listAll: async () => jobs,
    getByKey: async (payload) => jobs.find((j) => j.id === payload.id) ?? null,
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

describe('RefreshScheduler.schedule', () => {
  it('arms the timer when canSchedule=true AND cadence returns a value', async () => {
    const provider = makeProvider([]);
    const timer = makeTimer();
    const scheduler = new RefreshScheduler(provider, 'TestScheduler', timer);
    await scheduler.schedule({ id: 'j1', scheduleAt: 1_700_000_000_000, eligible: true });
    expect(timer.armCalls).toEqual([[keyOf('j1'), 1_700_000_000_000]]);
  });

  it('clears a stale key when canSchedule=false (ineligible)', async () => {
    const provider = makeProvider([]);
    const timer = makeTimer();
    const scheduler = new RefreshScheduler(provider, 'TestScheduler', timer);
    const ok = await scheduler.schedule({ id: 'j1', scheduleAt: 1_700_000_000_000, eligible: false });
    expect(ok).toBe(false);
    expect(timer.armCalls).toEqual([]);
    expect(timer.cancelCalls).toEqual([keyOf('j1')]);
  });

  it('clears a stale key when cadence returns null', async () => {
    const provider = makeProvider([]);
    const timer = makeTimer();
    const scheduler = new RefreshScheduler(provider, 'TestScheduler', timer);
    const ok = await scheduler.schedule({ id: 'j1', scheduleAt: null, eligible: true });
    expect(ok).toBe(false);
    expect(timer.cancelCalls).toEqual([keyOf('j1')]);
  });

  it('declines when the timer substrate is unavailable', async () => {
    const provider = makeProvider([]);
    const timer = makeTimer({ available: false });
    const scheduler = new RefreshScheduler(provider, 'TestScheduler', timer);
    const ok = await scheduler.schedule({ id: 'j1', scheduleAt: 1_700_000_000_000, eligible: true });
    expect(ok).toBe(false);
    expect(timer.armCalls).toEqual([]);
  });
});

describe('RefreshScheduler.reconcile', () => {
  it('arms every eligible job and clears orphan keys with our prefix', async () => {
    const provider = makeProvider([
      { id: 'a', scheduleAt: 1_000, eligible: true },
      { id: 'b', scheduleAt: 2_000, eligible: true },
    ]);
    const timer = makeTimer();
    // Existing keys: one of ours no longer wanted, one foreign.
    timer.externallyArmed.push(keyOf('zombie'), 'oauth-refresh:foreign');
    const scheduler = new RefreshScheduler(provider, 'TestScheduler', timer);
    await scheduler.reconcile();
    expect(timer.armCalls).toHaveLength(2);
    // Orphan (our-prefix but no longer in listAll) cleared:
    expect(timer.cancelCalls).toContain(keyOf('zombie'));
    // Foreign prefix LEFT ALONE:
    expect(timer.cancelCalls).not.toContain('oauth-refresh:foreign');
  });
});

describe('RefreshScheduler.handleFire', () => {
  it('fires → refreshes → succeeds on the happy path', async () => {
    const provider = makeProvider([{ id: 'j1', scheduleAt: 1_000, eligible: true }]);
    const scheduler = new RefreshScheduler(provider, 'TestScheduler', makeTimer());
    await scheduler.handleFire(keyOf('j1'));
    expect(provider.__hooks.fired).toHaveBeenCalledTimes(1);
    expect(provider.__hooks.refresh).toHaveBeenCalledTimes(1);
    expect(provider.__hooks.succeeded).toHaveBeenCalledTimes(1);
    expect(provider.__hooks.failed).not.toHaveBeenCalled();
  });

  it('routes to onFailed + recordFailure when refresh throws', async () => {
    const provider = makeProvider([{ id: 'j1', scheduleAt: 1_000, eligible: true }]);
    provider.__hooks.refresh.mockRejectedValue(new Error('boom'));
    const scheduler = new RefreshScheduler(provider, 'TestScheduler', makeTimer());
    await scheduler.handleFire(keyOf('j1'));
    expect(provider.__hooks.failed).toHaveBeenCalledTimes(1);
    expect(provider.__hooks.succeeded).not.toHaveBeenCalled();
    expect(provider.__hooks.recordFailure).toHaveBeenCalledTimes(1);
  });

  it('ignores keys with a foreign prefix', async () => {
    const provider = makeProvider([{ id: 'j1', scheduleAt: 1_000, eligible: true }]);
    const scheduler = new RefreshScheduler(provider, 'TestScheduler', makeTimer());
    await scheduler.handleFire('oauth-refresh:foreign');
    expect(provider.__hooks.fired).not.toHaveBeenCalled();
  });

  it('clears the key when the job no longer exists (race with delete)', async () => {
    const provider = makeProvider([]);
    const timer = makeTimer();
    const scheduler = new RefreshScheduler(provider, 'TestScheduler', timer);
    await scheduler.handleFire(keyOf('gone'));
    expect(timer.cancelCalls).toContain(keyOf('gone'));
    expect(provider.__hooks.refresh).not.toHaveBeenCalled();
  });

  it('clears the key when canSchedule flips false between schedule and fire', async () => {
    const provider = makeProvider([{ id: 'j1', scheduleAt: 1_000, eligible: false }]);
    const timer = makeTimer();
    const scheduler = new RefreshScheduler(provider, 'TestScheduler', timer);
    await scheduler.handleFire(keyOf('j1'));
    expect(timer.cancelCalls).toContain(keyOf('j1'));
    expect(provider.__hooks.refresh).not.toHaveBeenCalled();
  });

  it('re-arms off the post-write state after a successful refresh', async () => {
    const provider = makeProvider([{ id: 'j1', scheduleAt: 5_000, eligible: true }]);
    const timer = makeTimer();
    const scheduler = new RefreshScheduler(provider, 'TestScheduler', timer);
    await scheduler.handleFire(keyOf('j1'));
    expect(timer.armCalls).toEqual([[keyOf('j1'), 5_000]]);
  });

  it('re-arms after a deliberate skip even though nothing was written', async () => {
    // A gate-skip provider: refresh throws, recordFailure writes
    // nothing — the post-fire re-arm is the only thing lining up the
    // next attempt.
    const provider = makeProvider([{ id: 'j1', scheduleAt: 9_000, eligible: true }]);
    provider.__hooks.refresh.mockRejectedValue(new Error('circuit-blocked'));
    const timer = makeTimer();
    const scheduler = new RefreshScheduler(provider, 'TestScheduler', timer);
    await scheduler.handleFire(keyOf('j1'));
    expect(provider.__hooks.failed).toHaveBeenCalledTimes(1);
    expect(timer.armCalls).toEqual([[keyOf('j1'), 9_000]]);
  });

  it('guards against a concurrent dispatch of the same key', async () => {
    const provider = makeProvider([{ id: 'j1', scheduleAt: 1_000, eligible: true }]);
    let release: (() => void) | undefined;
    provider.__hooks.refresh.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    const scheduler = new RefreshScheduler(provider, 'TestScheduler', makeTimer());
    const first = scheduler.handleFire(keyOf('j1'));
    const second = scheduler.handleFire(keyOf('j1'));
    await second; // returns immediately — key is in flight
    expect(provider.__hooks.refresh).toHaveBeenCalledTimes(1);
    release?.();
    await first;
    expect(provider.__hooks.succeeded).toHaveBeenCalledTimes(1);
  });
});

describe('RefreshScheduler.start / stop', () => {
  it('subscribes exactly once (idempotent); stop unsubscribes', () => {
    const provider = makeProvider([]);
    const scheduler = new RefreshScheduler(provider, 'TestScheduler', makeTimer());
    scheduler.start();
    scheduler.start();
    expect(provider.__listenerCount()).toBe(1);
    scheduler.stop();
    expect(provider.__listenerCount()).toBe(0);
  });

  it('re-start after stop creates a fresh subscription', () => {
    const provider = makeProvider([]);
    const scheduler = new RefreshScheduler(provider, 'TestScheduler', makeTimer());
    scheduler.start();
    scheduler.stop();
    scheduler.start();
    expect(provider.__listenerCount()).toBe(1);
    scheduler.stop();
  });

  it('a store change reconciles immediately with no debounce configured', async () => {
    const provider = makeProvider([{ id: 'j1', scheduleAt: 1_000, eligible: true }]);
    const timer = makeTimer();
    const scheduler = new RefreshScheduler(provider, 'TestScheduler', timer);
    scheduler.start();
    provider.__fire();
    await vi.waitFor(() => expect(timer.armCalls.length).toBeGreaterThan(0));
    scheduler.stop();
  });

  it('debounces store-change reconciles into one pass when configured', async () => {
    vi.useFakeTimers();
    try {
      const provider = makeProvider([{ id: 'j1', scheduleAt: 1_000, eligible: true }]);
      const timer = makeTimer();
      const scheduler = new RefreshScheduler(provider, 'TestScheduler', timer, { reconcileDebounceMs: 50 });
      scheduler.start();
      provider.__fire();
      provider.__fire();
      provider.__fire();
      await vi.advanceTimersByTimeAsync(50);
      expect(timer.armCalls).toHaveLength(1);
      scheduler.stop();
    } finally {
      vi.useRealTimers();
    }
  });
});
