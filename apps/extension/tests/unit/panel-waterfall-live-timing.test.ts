/**
 * Live in-flight timing breakdown for the waterfall bar + hover popover.
 *
 * While a request streams, the HAR `timings.receive` leg has not landed, so a
 * pure HAR breakdown shows no Content Download row and freezes its total at the
 * first byte. `computeRowTimingPhases` splices in a LIVE receive leg —
 * `duration − latency`, where latency holds at the first byte and the download
 * grows per body chunk — so the popover's Content Download and total track the
 * row, matching the (already-live) Time column. A finished row stays
 * HAR-authoritative.
 */

import { computeTimingPhases, withLiveReceive } from '@openheaders/ui/panel/data/timing-phases';
import { computeRowTimingPhases } from '@openheaders/ui/panel/data/waterfall-geometry';
import { describe, expect, it } from 'vitest';
import { makeRow } from '../__factories__/lifecycle';

// blocked = 40 queueing + 60 stalled; send 10; wait 200 → first-byte legs sum
// to 310, of which queueing (40) is stripped from latency → 270.
const INFLIGHT_TIMINGS = {
  blocked: 100,
  _blocked_queueing: 40,
  dns: 0,
  connect: 0,
  send: 10,
  wait: 200,
  receive: 0,
} as const;

function ms(timing: { phases: readonly { key: string; ms: number }[] } | null, key: string): number | undefined {
  return timing?.phases.find((p) => p.key === key)?.ms;
}

describe('computeRowTimingPhases — live receive', () => {
  it('splices a live Content Download leg while the row streams', () => {
    // started 1000, latest chunk 2000 → duration 2000−1000−40(queue) = 960;
    // latency = 270; live receive = 960 − 270 = 690.
    const row = makeRow({
      startedAtMs: 1000,
      lastActivityAtMs: 2000,
      harOverrides: { time: -1, timings: { ...INFLIGHT_TIMINGS } },
    });
    const timing = computeRowTimingPhases(row);
    expect(timing).not.toBeNull();
    expect(ms(timing, 'receive')).toBe(690);
    // Pre-receive legs are untouched (latency holds at the first byte).
    expect(ms(timing, 'wait')).toBe(200);
    expect(ms(timing, 'queueing')).toBe(40);
    // Total = first-byte legs (310) + live download (690).
    expect(timing?.totalMs).toBe(1000);
    expect(timing?.byGroup.transfer.map((p) => p.key)).toEqual(['send', 'wait', 'receive']);
  });

  it('grows the download leg as later chunks advance lastActivityAtMs', () => {
    const at = (lastActivityAtMs: number) =>
      computeRowTimingPhases(
        makeRow({ startedAtMs: 1000, lastActivityAtMs, harOverrides: { time: -1, timings: { ...INFLIGHT_TIMINGS } } }),
      );
    expect(ms(at(2000), 'receive')).toBe(690);
    expect(ms(at(3000), 'receive')).toBe(1690);
    // Latency (the pre-receive sum) is identical across both readings.
    expect(ms(at(2000), 'wait')).toBe(ms(at(3000), 'wait'));
  });

  it('stays HAR-authoritative once the row has finished', () => {
    const row = makeRow({
      startedAtMs: 1000,
      completedAtMs: 1810,
      harOverrides: { time: 810, timings: { ...INFLIGHT_TIMINGS, receive: 500 } },
    });
    const timing = computeRowTimingPhases(row);
    // Equal to the plain HAR breakdown — no live splice.
    expect(ms(timing, 'receive')).toBe(500);
    expect(timing?.totalMs).toBe(810);
  });

  it('leaves a pre-first-byte pending row on its HAR phases (no live signal)', () => {
    // No lastActivityAtMs → nothing has streamed yet → no Content Download.
    const row = makeRow({ startedAtMs: 1000, harOverrides: { time: -1, timings: { ...INFLIGHT_TIMINGS } } });
    const timing = computeRowTimingPhases(row);
    expect(ms(timing, 'receive')).toBeUndefined();
    expect(timing?.totalMs).toBe(310);
  });
});

describe('withLiveReceive', () => {
  const base = computeTimingPhases({ timings: { ...INFLIGHT_TIMINGS } } as never);

  it('appends the receive leg last and recomputes the total + group', () => {
    const out = withLiveReceive(base!, 690);
    expect(ms(out, 'receive')).toBe(690);
    expect(out.phases[out.phases.length - 1].key).toBe('receive');
    expect(out.totalMs).toBe(1000);
    expect(out.byGroup.transfer.map((p) => p.key)).toEqual(['send', 'wait', 'receive']);
  });

  it('drops the receive row for a non-positive live value', () => {
    const out = withLiveReceive(base!, 0);
    expect(ms(out, 'receive')).toBeUndefined();
    expect(out.totalMs).toBe(310);
  });
});
