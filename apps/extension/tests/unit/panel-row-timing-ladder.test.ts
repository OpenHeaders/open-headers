import { waterfallSortValue } from '@openheaders/ui/panel/data/network-columns';
import { rowTimingLadder } from '@openheaders/ui/panel/data/row-timing-ladder';
import type { TimingLadder, TimingRungKey } from '@openheaders/ui/panel/data/timing-ladder';
import { describe, expect, it } from 'vitest';
import { makeRow } from '../__factories__/lifecycle';

// The github.com main-document load — the exporter's `connect` spans `ssl`
// (HAR 1.2) AND `dns` (it is anchored at the dns start when a lookup ran), so
// the honest ladder splits TCP = connect − ssl − dns; the rungs then sum to
// the real wall span (`time` − dns, the exported leg sum double-counts dns).
const GH_TIMINGS = {
  blocked: 4.367,
  dns: 26.386,
  ssl: 127.54,
  connect: 280.344,
  send: 0.39,
  wait: 129.846,
  receive: 377.882,
  _blocked_queueing: 3.343,
} as const;
const GH_TIME = 819.215;

function rungMs(ladder: TimingLadder, key: TimingRungKey): number | null {
  const state = ladder.rungs.find((r) => r.key === key)?.state;
  return state?.kind === 'elapsed' ? state.ms : null;
}

describe('rowTimingLadder', () => {
  it('builds the honest ladder from a finished HAR (TCP = connect − ssl − dns)', () => {
    const row = makeRow({
      startedAtMs: 1000,
      completedAtMs: 1000 + GH_TIME - GH_TIMINGS.dns,
      statusCode: 200,
      harOverrides: { time: GH_TIME, timings: { ...GH_TIMINGS } },
    });
    const ladder = rowTimingLadder(row);
    expect(ladder).not.toBeNull();
    if (!ladder) return;
    // TCP = connect − ssl − dns = 126.418 — the dns-anchored exported connect
    // peeled down to the TCP-only handshake.
    expect(rungMs(ladder, 'connect')).toBeCloseTo(GH_TIMINGS.connect - GH_TIMINGS.ssl - GH_TIMINGS.dns, 3);
    expect(rungMs(ladder, 'ssl')).toBeCloseTo(GH_TIMINGS.ssl, 3);
    expect(rungMs(ladder, 'dns')).toBeCloseTo(GH_TIMINGS.dns, 3);
    // Honest total = the real wall span (every leg counted once).
    expect(ladder.durationMs).toBeCloseTo(GH_TIME - GH_TIMINGS.dns, 3);
    expect(ladder.responseMs).not.toBeNull();
  });

  it('returns null with no HAR — an in-flight (unknown) row has no ladder yet', () => {
    const row = makeRow({ startedAtMs: 1000, har: [null] });
    expect(rowTimingLadder(row)).toBeNull();
  });

  it('splices a live Content Download leg while streaming (duration − latency)', () => {
    const row = makeRow({
      startedAtMs: 1000,
      statusCode: 200,
      lastActivityAtMs: 1000 + GH_TIMINGS._blocked_queueing + 600,
      harOverrides: { timings: { ...GH_TIMINGS, receive: -1 } },
    });
    const ladder = rowTimingLadder(row);
    expect(ladder).not.toBeNull();
    if (!ladder) return;
    const expectedReceive = Math.max(waterfallSortValue(row, 'duration') - waterfallSortValue(row, 'latency'), 0);
    expect(rungMs(ladder, 'receive')).toBeCloseTo(expectedReceive, 3);
  });
});
