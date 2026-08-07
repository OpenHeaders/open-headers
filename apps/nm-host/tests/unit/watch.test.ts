/**
 * Watch verb — message-shape validation, the loopback pin on the
 * watched address, the transition discipline (verify once per down→up,
 * signal once, refused listeners latch quiet until presence cycles),
 * and the heartbeat cadence over injected timer seams.
 */

import { describe, expect, it } from 'vitest';
import {
  parseWatchRequest,
  startWatch,
  WATCH_HEARTBEAT_INTERVAL_MS,
  WATCH_POLL_INTERVAL_MS,
  type WatchDeps,
} from '../../src/watch';

describe('parseWatchRequest', () => {
  it('accepts the watch shape and refuses foreign ones', () => {
    expect(parseWatchRequest({ kind: 'watch', url: 'ws://127.0.0.1:59210' })).toEqual({ url: 'ws://127.0.0.1:59210' });
    expect(parseWatchRequest(null)).toBeNull();
    expect(parseWatchRequest({ kind: 'bootstrap', url: 'ws://127.0.0.1:59210' })).toBeNull();
    expect(parseWatchRequest({ kind: 'watch' })).toBeNull();
  });
});

interface PendingTimer {
  readonly id: number;
  readonly fn: () => void;
  readonly ms: number;
}

function makeTimerHarness() {
  let nextId = 1;
  const pending = new Map<number, PendingTimer>();
  return {
    setTimer: (fn: () => void, ms: number): unknown => {
      const id = nextId++;
      pending.set(id, { id, fn, ms });
      return id;
    },
    clearTimer: (handle: unknown): void => {
      pending.delete(handle as number);
    },
    fire(ms: number): void {
      const timer = [...pending.values()].find((t) => t.ms === ms);
      if (!timer) throw new Error(`no pending ${ms}ms timer`);
      pending.delete(timer.id);
      timer.fn();
    },
    pendingIntervals(): number[] {
      return [...pending.values()].map((t) => t.ms);
    },
  };
}

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

interface WatchFixture {
  posts: Record<string, unknown>[];
  verifiedPorts: number[];
  setListening(value: boolean): void;
  setVerified(value: boolean): void;
  harness: ReturnType<typeof makeTimerHarness>;
  session: ReturnType<typeof startWatch>;
}

function armWatch(url = 'ws://127.0.0.1:59210', overrides: Partial<WatchDeps> = {}): WatchFixture {
  const harness = makeTimerHarness();
  const posts: Record<string, unknown>[] = [];
  const verifiedPorts: number[] = [];
  let listening = false;
  let verified = true;
  const session = startWatch(
    { url },
    {
      post: (message) => posts.push(message),
      probe: async () => listening,
      verifyListener: async (port) => {
        verifiedPorts.push(port);
        return verified;
      },
      setTimer: harness.setTimer,
      clearTimer: harness.clearTimer,
      ...overrides,
    },
  );
  return {
    posts,
    verifiedPorts,
    setListening: (value) => {
      listening = value;
    },
    setVerified: (value) => {
      verified = value;
    },
    harness,
    session,
  };
}

describe('startWatch', () => {
  it('refuses a non-loopback or foreign-scheme URL without arming', () => {
    const harness = makeTimerHarness();
    const deps: WatchDeps = {
      post: () => {},
      probe: async () => true,
      setTimer: harness.setTimer,
      clearTimer: harness.clearTimer,
    };
    expect(startWatch({ url: 'ws://192.168.1.20:59210' }, deps)).toBeNull();
    expect(startWatch({ url: 'wss://127.0.0.1:59210' }, deps)).toBeNull();
    expect(startWatch({ url: 'not a url' }, deps)).toBeNull();
    expect(harness.pendingIntervals()).toEqual([]);
  });

  it('posts the up-signal once when a verified listener appears', async () => {
    const fixture = armWatch();
    await flush();
    expect(fixture.posts).toEqual([]);
    fixture.setListening(true);
    fixture.harness.fire(WATCH_POLL_INTERVAL_MS);
    await flush();
    expect(fixture.posts).toEqual([{ kind: 'watch', up: true }]);
    expect(fixture.verifiedPorts).toEqual([59210]);
    // Presence holding steady never re-verifies or re-signals.
    fixture.harness.fire(WATCH_POLL_INTERVAL_MS);
    await flush();
    fixture.harness.fire(WATCH_POLL_INTERVAL_MS);
    await flush();
    expect(fixture.posts).toHaveLength(1);
    expect(fixture.verifiedPorts).toHaveLength(1);
  });

  it('re-signals after presence drops and returns', async () => {
    const fixture = armWatch();
    fixture.setListening(true);
    await flush();
    fixture.harness.fire(WATCH_POLL_INTERVAL_MS);
    await flush();
    expect(fixture.posts).toHaveLength(1);
    fixture.setListening(false);
    fixture.harness.fire(WATCH_POLL_INTERVAL_MS);
    await flush();
    fixture.setListening(true);
    fixture.harness.fire(WATCH_POLL_INTERVAL_MS);
    await flush();
    expect(fixture.posts).toEqual([
      { kind: 'watch', up: true },
      { kind: 'watch', up: true },
    ]);
    expect(fixture.verifiedPorts).toHaveLength(2);
  });

  it('latches quiet on a refused listener until presence cycles', async () => {
    const fixture = armWatch();
    fixture.setVerified(false);
    fixture.setListening(true);
    await flush();
    expect(fixture.posts).toEqual([]);
    // The squatter costs exactly one verification chain, not one per poll.
    fixture.harness.fire(WATCH_POLL_INTERVAL_MS);
    await flush();
    fixture.harness.fire(WATCH_POLL_INTERVAL_MS);
    await flush();
    expect(fixture.verifiedPorts).toHaveLength(1);
    expect(fixture.posts).toEqual([]);
    // Presence cycles and the real app answers — signal goes out.
    fixture.setListening(false);
    fixture.harness.fire(WATCH_POLL_INTERVAL_MS);
    await flush();
    fixture.setVerified(true);
    fixture.setListening(true);
    fixture.harness.fire(WATCH_POLL_INTERVAL_MS);
    await flush();
    expect(fixture.verifiedPorts).toHaveLength(2);
    expect(fixture.posts).toEqual([{ kind: 'watch', up: true }]);
  });

  it('heartbeats on its own cadence regardless of presence', async () => {
    const fixture = armWatch();
    await flush();
    fixture.harness.fire(WATCH_HEARTBEAT_INTERVAL_MS);
    expect(fixture.posts).toEqual([{ kind: 'watch', heartbeat: true }]);
    // The heartbeat rescheduled itself.
    fixture.harness.fire(WATCH_HEARTBEAT_INTERVAL_MS);
    expect(fixture.posts).toEqual([
      { kind: 'watch', heartbeat: true },
      { kind: 'watch', heartbeat: true },
    ]);
  });

  it('stop cancels both timer chains and abandons in-flight ticks', async () => {
    const fixture = armWatch();
    await flush();
    expect(fixture.harness.pendingIntervals().sort()).toEqual(
      [WATCH_HEARTBEAT_INTERVAL_MS, WATCH_POLL_INTERVAL_MS].sort(),
    );
    fixture.session?.stop();
    expect(fixture.harness.pendingIntervals()).toEqual([]);
    fixture.setListening(true);
    await flush();
    expect(fixture.posts).toEqual([]);
  });
});
