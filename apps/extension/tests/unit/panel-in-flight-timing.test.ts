import { computeInFlightTiming } from '@openheaders/ui/panel/data/timing/in-flight-timing';
import { describe, expect, it } from 'vitest';
import { makeLifecycle } from '../__factories__/lifecycle';

// `har: [null]` is the realistic in-flight shape — no HAR has landed yet, so
// `waterfallStartMs` falls back to the lifecycle issue time.
describe('computeInFlightTiming', () => {
  it('measures the queue offset from the supplied zero, clamped at 0', () => {
    const lc = makeLifecycle({ startedAtMs: 1500, har: [null] });
    expect(computeInFlightTiming(lc, 1000).queuedAtMs).toBe(500);
    // A zero past the issue time never yields a negative offset.
    expect(computeInFlightTiming(lc, 2000).queuedAtMs).toBe(0);
  });

  it('stays stalled when no network start is known — Started collapses onto Queued', () => {
    const lc = makeLifecycle({ startedAtMs: 1000, hopStartedAtMs: 1000, har: [null] });
    const t = computeInFlightTiming(lc, 1000);
    expect(t.networkStarted).toBe(false);
    expect(t.startedAtMs).toBe(t.queuedAtMs);
  });

  it('reports the network start once the request leaves the queue for the wire', () => {
    const lc = makeLifecycle({ startedAtMs: 1000, hopStartedAtMs: 1000, hopNetworkStartMs: 1080, har: [null] });
    const t = computeInFlightTiming(lc, 1000);
    expect(t.networkStarted).toBe(true);
    // queued (0) + (networkStart − hopStart) = 80
    expect(t.startedAtMs).toBe(80);
  });
});
