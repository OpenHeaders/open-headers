/**
 * Resource Timing sampler — the devtools-page poll that scopes the
 * cumulative Resource Timing buffer to the current DevTools session.
 *
 * `filterEntriesSinceOpen` is the pure session floor; the sampler wraps it
 * with the change-count gate and the ramped poll loop. Both are driven
 * here without a chrome eval mock — the chrome seam is injected.
 */

import type { ResourceTimingEntry } from '@openheaders/core/resource-timing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createResourceTimingSampler,
  filterEntriesSinceOpen,
  type ResourceTimingSnapshot,
} from '@/devtools/resource-timing-sampler';

function entry(name: string, startTime: number, overrides: Partial<ResourceTimingEntry> = {}): ResourceTimingEntry {
  return {
    name,
    initiatorType: 'script',
    nextHopProtocol: 'h2',
    startTime,
    duration: 0,
    transferSize: 0,
    encodedBodySize: 0,
    decodedBodySize: 0,
    deliveryType: '',
    ...overrides,
  };
}

type EvalCb = (result: ResourceTimingSnapshot | null, err?: unknown) => void;

describe('filterEntriesSinceOpen', () => {
  it('drops entries whose wall-clock start predates the open moment, keeping the boundary', () => {
    const snapshot: ResourceTimingSnapshot = {
      timeOriginMs: 1000,
      entries: [
        entry('https://openheaders.io/before.js', 0), // 1000 < 1500 → dropped
        entry('https://openheaders.io/boundary.js', 500), // 1500 === 1500 → kept
        entry('https://openheaders.io/after.js', 800), // 1800 > 1500 → kept
      ],
    };

    const floored = filterEntriesSinceOpen(snapshot, 1500);

    expect(floored.entries.map((e) => e.name)).toEqual([
      'https://openheaders.io/boundary.js',
      'https://openheaders.io/after.js',
    ]);
    expect(floored.timeOriginMs).toBe(1000);
  });

  it('returns the same reference when nothing is filtered', () => {
    const snapshot: ResourceTimingSnapshot = {
      timeOriginMs: 1000,
      entries: [entry('https://openheaders.io/a.js', 0)],
    };
    expect(filterEntriesSinceOpen(snapshot, 0)).toBe(snapshot);
  });

  it('floors a buffer entirely below the open moment to no entries', () => {
    const snapshot: ResourceTimingSnapshot = {
      timeOriginMs: 1000,
      entries: [entry('https://openheaders.io/a.js', 0), entry('https://openheaders.io/b.js', 100)],
    };
    expect(filterEntriesSinceOpen(snapshot, 5000).entries).toEqual([]);
  });
});

describe('createResourceTimingSampler', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('forwards only post-open entries on each tick', () => {
    const snapshot: ResourceTimingSnapshot = {
      timeOriginMs: 1000,
      entries: [entry('https://openheaders.io/before.js', 0), entry('https://openheaders.io/after.js', 600)],
    };
    const forward = vi.fn();
    const evalInPage = vi.fn((_expr: string, cb: EvalCb) => cb(snapshot));

    const sampler = createResourceTimingSampler({ evalInPage, forward, openedAtWallMs: 1500 });
    sampler.restart();

    expect(forward).toHaveBeenCalledTimes(1);
    expect(forward.mock.calls[0][0].entries.map((e: ResourceTimingEntry) => e.name)).toEqual([
      'https://openheaders.io/after.js',
    ]);
    sampler.stop();
  });

  it('suppresses a forward when the floored count is unchanged', () => {
    const snapshot: ResourceTimingSnapshot = {
      timeOriginMs: 1000,
      entries: [entry('https://openheaders.io/after.js', 600)],
    };
    const forward = vi.fn();
    const evalInPage = vi.fn((_expr: string, cb: EvalCb) => cb(snapshot));

    const sampler = createResourceTimingSampler({ evalInPage, forward, openedAtWallMs: 1500 });
    sampler.restart();
    vi.advanceTimersByTime(100); // next tick, identical snapshot

    expect(forward).toHaveBeenCalledTimes(1);
    sampler.stop();
  });

  it('restart resets the change gate so the first post of a new page always lands', () => {
    const snapshot: ResourceTimingSnapshot = {
      timeOriginMs: 1000,
      entries: [entry('https://openheaders.io/after.js', 600)],
    };
    const forward = vi.fn();
    const evalInPage = vi.fn((_expr: string, cb: EvalCb) => cb(snapshot));

    const sampler = createResourceTimingSampler({ evalInPage, forward, openedAtWallMs: 1500 });
    sampler.restart();
    sampler.restart();

    expect(forward).toHaveBeenCalledTimes(2);
    sampler.stop();
  });

  it('stop halts further polling', () => {
    const snapshot: ResourceTimingSnapshot = { timeOriginMs: 1000, entries: [entry('https://openheaders.io/a.js', 600)] };
    const evalInPage = vi.fn((_expr: string, cb: EvalCb) => cb(snapshot));

    const sampler = createResourceTimingSampler({ evalInPage, forward: vi.fn(), openedAtWallMs: 0 });
    sampler.restart();
    const callsAtStop = evalInPage.mock.calls.length;
    sampler.stop();
    vi.advanceTimersByTime(1000);

    expect(evalInPage.mock.calls.length).toBe(callsAtStop);
  });

  it('ignores eval errors and null results', () => {
    const forward = vi.fn();
    const evalInPage = vi.fn((_expr: string, cb: EvalCb) => cb(null, { isError: true }));

    const sampler = createResourceTimingSampler({ evalInPage, forward, openedAtWallMs: 0 });
    sampler.restart();

    expect(forward).not.toHaveBeenCalled();
    sampler.stop();
  });
});
