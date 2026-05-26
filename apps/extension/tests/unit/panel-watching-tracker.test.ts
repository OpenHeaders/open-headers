/**
 * Panel-watching tracker translates a lifecycle-port lifetime into a
 * tab-telemetry tracking ref. Asserts:
 *   - start/stop pair fires on attach + release with matching reason
 *   - sequence makes each tracker's reason unique within a tab
 *   - release() is idempotent
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  __internalsForTests,
  attachPanelWatchingTracker,
} from '@/background/lifecycle-port-host/panel-watching-tracker';

beforeEach(() => {
  __internalsForTests.resetSeq();
});

describe('attachPanelWatchingTracker', () => {
  it('starts tracking on attach with a tabId-scoped reason', () => {
    const start = vi.fn();
    const stop = vi.fn();
    attachPanelWatchingTracker(42, { start, stop });
    expect(start).toHaveBeenCalledTimes(1);
    expect(start.mock.calls[0]?.[0]).toBe(42);
    expect(start.mock.calls[0]?.[1]).toMatch(/^panel-watching:42:\d+$/);
    expect(stop).not.toHaveBeenCalled();
  });

  it('release() stops tracking with the same reason that was started', () => {
    const start = vi.fn();
    const stop = vi.fn();
    const tracker = attachPanelWatchingTracker(7, { start, stop });
    const reason = start.mock.calls[0]?.[1];
    tracker.release();
    expect(stop).toHaveBeenCalledTimes(1);
    expect(stop.mock.calls[0]).toEqual([7, reason]);
  });

  it('mints a unique reason per attach so multiple panels on one tab each hold their own slot', () => {
    const start = vi.fn();
    const stop = vi.fn();
    attachPanelWatchingTracker(1, { start, stop });
    attachPanelWatchingTracker(1, { start, stop });
    const r1 = start.mock.calls[0]?.[1];
    const r2 = start.mock.calls[1]?.[1];
    expect(r1).not.toBe(r2);
    expect(r1).toMatch(/^panel-watching:1:\d+$/);
    expect(r2).toMatch(/^panel-watching:1:\d+$/);
  });

  it('release() is idempotent — second call is a no-op', () => {
    const start = vi.fn();
    const stop = vi.fn();
    const tracker = attachPanelWatchingTracker(3, { start, stop });
    tracker.release();
    tracker.release();
    expect(stop).toHaveBeenCalledTimes(1);
  });
});
