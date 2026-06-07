/**
 * Sorting the table by the Waterfall column under each metric. The sort key
 * follows the active metric via `waterfallSortValue`, so the same live values
 * the bars/columns show must drive the order: an in-flight row sorts by its
 * growing end-time/duration (the browser re-sorts as `endTime` advances) and
 * by its fixed first-byte latency — it must NOT clump at the `-1` "unknown"
 * edge with a truly-pending row just because it hasn't finished.
 */

import { sortCompare } from '@openheaders/ui/panel/components/traffic/sort';
import { describe, expect, it } from 'vitest';
import { makeRow } from '../__factories__/lifecycle';

// Finished 600 ms request (HAR landed): endTime 1600, latency 100, duration 600.
const finished = makeRow({
  requestId: 'finished',
  startedAtMs: 1000,
  completedAtMs: 1600,
  harOverrides: { time: 600, timings: { blocked: 0, dns: 0, connect: 0, send: 0, wait: 100, receive: 500 } },
});

// Streaming: headers in (wait=50, receive still -1), body downloading — endTime
// 1700 (grows), duration 700, latency fixed at the 50 ms first byte.
const streaming = makeRow({
  requestId: 'streaming',
  startedAtMs: 1000,
  statusCode: 200,
  lastActivityAtMs: 1700,
  harOverrides: { timings: { blocked: 0, dns: 0, connect: 0, send: 0, wait: 50, receive: -1 } },
});

// Truly pending — no first byte yet, every metric unknown (-1).
const pending = makeRow({ requestId: 'pending', startedAtMs: 1000 });

function order(metric: 'endTime' | 'duration' | 'latency', dir: 'asc' | 'desc'): string[] {
  return [finished, streaming, pending]
    .slice()
    .sort((a, b) => sortCompare(a, b, 'waterfall', dir, metric))
    .map((r) => r.lifecycle.requestId);
}

describe('waterfall-metric table sort with in-flight rows', () => {
  it('end time: a streaming row sorts by its live (growing) end, after an earlier-finished row', () => {
    // endTimes: pending -1, finished 1600, streaming 1700.
    expect(order('endTime', 'asc')).toEqual(['pending', 'finished', 'streaming']);
    expect(order('endTime', 'desc')).toEqual(['streaming', 'finished', 'pending']);
  });

  it('total duration: the streaming row sorts by its growing duration, not at the unknown edge', () => {
    // durations: pending -1, finished 600, streaming 700.
    expect(order('duration', 'asc')).toEqual(['pending', 'finished', 'streaming']);
  });

  it('latency: the streaming row sorts by its FIXED first-byte latency (50), between pending and finished', () => {
    // latencies: pending -1, streaming 50, finished 100 — proves the streaming
    // row leaves the -1 group and orders by its stable first-byte value.
    expect(order('latency', 'asc')).toEqual(['pending', 'streaming', 'finished']);
  });
});
