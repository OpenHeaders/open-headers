/**
 * Instant-anchored timing ladder — the raw-instant decode (`_rawTiming`):
 * each rung between its true instants (Request sent = sendStart→sendEnd),
 * the inter-leg gaps belonging to no rung, the wait boundary at the
 * clamped headers-received instant, and the total as the range span.
 */

import type { InspectorRawTiming } from '@openheaders/core/types';
import type { LadderContext } from '@openheaders/ui/panel/data/timing-ladder';
import { computeRawTimingLadder, rawFirstByteMs, rawSpanMs } from '@openheaders/ui/panel/data/timing-ladder-raw';
import { ladderFootnotes, ladderGaps } from '@openheaders/ui/panel/data/timing-popover-model';
import { describe, expect, it } from 'vitest';

function ladder(raw: InspectorRawTiming, ctx: Partial<LadderContext> = {}) {
  return computeRawTimingLadder(raw, { reachedResponse: true, isHttps: true, ...ctx });
}

/** Map rung key → its state, for compact assertions. */
function states(l: ReturnType<typeof ladder>): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const r of l.rungs) out[r.key] = r.state.kind === 'elapsed' ? r.state.ms : r.state.kind;
  return out;
}

function start(l: ReturnType<typeof ladder>, key: string): number {
  const rung = l.rungs.find((r) => r.key === key);
  if (rung === undefined) throw new Error(`no rung ${key}`);
  return rung.startMs;
}

/**
 * A full cold-connection document, shaped like the live github run: real
 * inter-leg gaps at dnsEnd→connectStart (0.21) and connectEnd→sendStart
 * (1.76), Request sent = 2.03, headers event arriving just after
 * receiveHeadersEnd (the clamp binds).
 */
const FULL: InspectorRawTiming = {
  issuedSec: 99.9985, // 1.5 ms before the network start
  requestTimeSec: 100,
  dnsStart: 1,
  dnsEnd: 98.17,
  connectStart: 98.38,
  connectEnd: 368.83,
  sslStart: 232.25,
  sslEnd: 368.83,
  sendStart: 370.59,
  sendEnd: 372.62,
  receiveHeadersEnd: 500,
  responseReceivedSec: 100.5005, // 500.5 ms — past receiveHeadersEnd, clamped
  endSec: 108.75, // 8750 ms
};

describe('computeRawTimingLadder — tab-exact decomposition', () => {
  it('decodes every rung between its true instants', () => {
    const l = ladder(FULL);
    const s = states(l);
    expect(s.queueing).toBeCloseTo(1.5, 6);
    expect(s.stalled).toBeCloseTo(1, 6); // 0 → dnsStart
    expect(s.dns).toBeCloseTo(97.17, 6);
    expect(s.connect).toBeCloseTo(133.87, 6); // (368.83 − 98.38) − 136.58: TCP only
    expect(s.ssl).toBeCloseTo(136.58, 6);
    expect(s.send).toBeCloseTo(2.03, 6); // sendStart → sendEnd, the tab's Request sent
    expect(s.wait).toBeCloseTo(127.38, 6); // sendEnd → clamped headers-received (500)
    expect(s.receive).toBeCloseTo(8250, 6); // headers-received → terminal
  });

  it('anchors each rung at its real instant (queue moment = 0)', () => {
    const l = ladder(FULL);
    expect(start(l, 'queueing')).toBe(0);
    expect(start(l, 'stalled')).toBeCloseTo(1.5, 6);
    expect(start(l, 'dns')).toBeCloseTo(2.5, 6);
    expect(start(l, 'connect')).toBeCloseTo(99.88, 6);
    expect(start(l, 'ssl')).toBeCloseTo(233.75, 6); // TCP ends exactly at sslStart
    expect(start(l, 'send')).toBeCloseTo(372.09, 6); // AFTER the connect gap
    expect(start(l, 'wait')).toBeCloseTo(374.12, 6);
    expect(start(l, 'receive')).toBeCloseTo(501.5, 6);
  });

  it('totals to the range span, not the leg sum, and reports real instants', () => {
    const l = ladder(FULL);
    expect(l.durationMs).toBeCloseTo(8751.5, 6); // queueing + endOffset
    expect(l.startedMs).toBeCloseTo(1.5, 6);
    expect(l.responseMs).toBeCloseTo(501.5, 6);
    expect(l.endedMs).toBeCloseTo(8751.5, 6);
    expect(l.instantAnchored).toBe(true);
    // The two gaps are exactly the leg-sum shortfall.
    const legSum = l.rungs.reduce((a, r) => a + (r.state.kind === 'elapsed' ? r.state.ms : 0), 0);
    expect(l.durationMs - legSum).toBeCloseTo(0.21 + 1.76, 6);
  });

  it('lists the inter-leg gaps, in wire order', () => {
    const gaps = ladderGaps(ladder(FULL));
    expect(gaps).toHaveLength(2);
    expect(gaps[0]?.fromLabel).toBe('DNS Lookup');
    expect(gaps[0]?.toLabel).toBe('TCP');
    expect(gaps[0]?.ms).toBeCloseTo(0.21, 6);
    expect(gaps[1]?.fromLabel).toBe('TLS');
    expect(gaps[1]?.toLabel).toBe('Request sent');
    expect(gaps[1]?.ms).toBeCloseTo(1.76, 6);
  });

  it('footnotes carry the gaps line and the Chrome-equivalent connection line', () => {
    const notes = ladderFootnotes(ladder(FULL));
    expect(notes).toHaveLength(2);
    expect(notes[0]).toContain('DNS Lookup → TCP');
    expect(notes[0]).toContain('TLS → Request sent');
    expect(notes[1]).toContain('Initial connection = TCP');
    expect(notes[1]).toContain('+ TLS');
  });
});

describe('computeRawTimingLadder — wait boundary clamp', () => {
  it('uses the headers event instant when it precedes receiveHeadersEnd', () => {
    const l = ladder({ ...FULL, responseReceivedSec: 100.4995 }); // 499.5 < 500
    const wait = l.rungs.find((r) => r.key === 'wait')?.state;
    expect(wait).toEqual({ kind: 'elapsed', ms: expect.closeTo(126.88, 6) }); // 499.5 − 372.62
    expect(l.responseMs).toBeCloseTo(501, 6); // 1.5 + 499.5
  });

  it('falls back to receiveHeadersEnd when no event instant exists (redirect hop)', () => {
    const { responseReceivedSec: _evt, ...rest } = FULL;
    const l = ladder(rest);
    expect(l.responseMs).toBeCloseTo(501.5, 6);
  });

  it('clamps the terminal to at least the first byte', () => {
    expect(rawSpanMs({ ...FULL, endSec: 100.4 })).toBeCloseTo(500, 6); // end 400 < first byte 500
  });
});

describe('computeRawTimingLadder — reused connection / partial blocks', () => {
  const REUSED: InspectorRawTiming = {
    issuedSec: 100,
    requestTimeSec: 100, // no queue
    sendStart: 5,
    sendEnd: 8,
    receiveHeadersEnd: 40,
    responseReceivedSec: 100.041,
    endSec: 100.06,
  };

  it('marks the absent setup steps reused and decodes the exchange from instants', () => {
    const l = ladder(REUSED);
    expect(states(l)).toEqual({
      queueing: 0,
      stalled: 5, // 0 → sendStart
      dns: 'reused',
      connect: 'reused',
      ssl: 'reused',
      send: 3,
      wait: expect.closeTo(32, 6), // sendEnd 8 → headers 40
      receive: expect.closeTo(20, 6), // 40 → 60
    });
    expect(ladderGaps(l)).toHaveLength(0);
    expect(ladderFootnotes(l)).toHaveLength(0); // contiguous + no TLS to map
  });

  it('marks TLS n/a on a plaintext request', () => {
    const l = ladder(REUSED, { isHttps: false });
    expect(l.rungs.find((r) => r.key === 'ssl')?.state).toEqual({ kind: 'na' });
  });

  it('an in-flight block (no terminal) reads receive unknown and spans to the first byte', () => {
    const { endSec: _end, ...streaming } = REUSED;
    const l = ladder(streaming);
    expect(l.rungs.find((r) => r.key === 'receive')?.state).toEqual({ kind: 'unknown' });
    expect(l.durationMs).toBeCloseTo(40, 6);
  });

  it('splices the live Content Download override while streaming', () => {
    const { endSec: _end, ...streaming } = REUSED;
    const l = ladder(streaming, { liveReceiveMs: 500 });
    expect(l.rungs.find((r) => r.key === 'receive')?.state).toEqual({ kind: 'elapsed', ms: 500 });
    expect(l.durationMs).toBeCloseTo(540, 6);
  });
});

describe('raw column helpers', () => {
  it('rawSpanMs is the browser Time column (endTime − startTime, queueing excluded)', () => {
    expect(rawSpanMs(FULL)).toBeCloseTo(8750, 6);
    const { endSec: _end, ...streaming } = FULL;
    expect(rawSpanMs(streaming)).toBeUndefined();
  });

  it('rawFirstByteMs is the clamped first-byte latency', () => {
    expect(rawFirstByteMs(FULL)).toBeCloseTo(500, 6); // event 500.5 clamped to rhe 500
    expect(rawFirstByteMs({ ...FULL, responseReceivedSec: 100.4995 })).toBeCloseTo(499.5, 6);
  });
});
