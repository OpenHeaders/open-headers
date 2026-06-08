/**
 * Timing ladder — the honest, full-picture breakdown. Always eight rungs, each
 * with an explicit state (a real duration incl. `0`, or `reused` / `not
 * reached` / `n/a`); `Initial connection = connect − ssl` (TCP only).
 */

import type { InspectorHarEntry } from '@openheaders/core/types';
import { computeTimingLadder, type LadderContext, type TimingRungKey } from '@openheaders/ui/panel/data/timing-ladder';
import { describe, expect, it } from 'vitest';
import { makeHar } from '../../__factories__/lifecycle';

type Timings = NonNullable<InspectorHarEntry['timings']>;

function ladder(timings: Timings, ctx: Partial<LadderContext> = {}) {
  const har = makeHar('https://openheaders.io/', { timings });
  const result = computeTimingLadder(har, { reachedResponse: true, isHttps: true, ...ctx });
  if (result == null) throw new Error('expected a ladder');
  return result;
}

/** Map rung key → its state, for compact assertions. */
function states(l: ReturnType<typeof ladder>): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const r of l.rungs) out[r.key] = r.state.kind === 'elapsed' ? r.state.ms : r.state.kind;
  return out;
}

/** Example A from the explainer: clean, every phase real. */
const NORMAL: Timings = {
  blocked: 15, // queueing 10 + stalled 5
  _blocked_queueing: 10,
  dns: 20,
  connect: 45, // TCP 15 + TLS 30
  ssl: 30,
  send: 5,
  wait: 100,
  receive: 40,
};

describe('computeTimingLadder — always eight rungs, in order', () => {
  it('emits all eight rungs even when several are zero', () => {
    const keys = ladder(NORMAL).rungs.map((r) => r.key);
    expect(keys).toEqual<TimingRungKey[]>(['queueing', 'stalled', 'dns', 'connect', 'ssl', 'send', 'wait', 'receive']);
  });

  it('decomposes a normal request honestly (TCP = connect − ssl) with real instants', () => {
    const l = ladder(NORMAL);
    expect(states(l)).toEqual({
      queueing: 10,
      stalled: 5,
      dns: 20,
      connect: 15, // 45 − 30, NOT 45
      ssl: 30,
      send: 5,
      wait: 100,
      receive: 40,
    });
    expect(l.startedMs).toBe(10); // queue + queueing
    expect(l.responseMs).toBe(185); // through Waiting
    expect(l.endedMs).toBe(225);
    expect(l.durationMs).toBe(225);
  });

  it('positions each rung at its cumulative start', () => {
    const l = ladder(NORMAL);
    const start = (k: string) => l.rungs.find((r) => r.key === k)?.startMs;
    expect(start('queueing')).toBe(0);
    expect(start('stalled')).toBe(10);
    expect(start('dns')).toBe(15);
    expect(start('connect')).toBe(35);
    expect(start('ssl')).toBe(50);
    expect(start('wait')).toBe(85);
    expect(start('receive')).toBe(185);
  });
});

describe('computeTimingLadder — the all-TLS connection (the woff2 case)', () => {
  it('shows TCP 0µs + the full TLS, nothing hidden', () => {
    // connect == ssl: the whole connection was the TLS handshake.
    const l = ladder({
      blocked: 0.447,
      _blocked_queueing: 0.447,
      dns: 0,
      connect: 153.032,
      ssl: 153.032,
      send: 0,
      wait: 32.039,
      receive: 284.693,
    });
    expect(states(l)).toEqual({
      queueing: 0.447,
      stalled: 0,
      dns: 0,
      connect: 0, // TCP was instant — TLS was the whole connection
      ssl: 153.032,
      send: 0,
      wait: 32.039,
      receive: 284.693,
    });
    expect(l.durationMs).toBeCloseTo(470.211, 3);
  });
});

describe('computeTimingLadder — the connect − ssl bug fix', () => {
  it('does not subtract DNS out of the connection (TCP = connect − ssl only)', () => {
    // crypto.com doc: connect 144.34, ssl 95.587, dns 48.532.
    // Correct TCP = 144.34 − 95.587 = 48.753 (the old code gave ~0.22).
    const l = ladder({
      blocked: 1,
      _blocked_queueing: 1,
      dns: 48.532,
      connect: 144.34,
      ssl: 95.587,
      send: 0.139,
      wait: 113,
      receive: 1,
    });
    const tcp = l.rungs.find((r) => r.key === 'connect')?.state;
    expect(tcp).toEqual({ kind: 'elapsed', ms: expect.closeTo(48.753, 3) });
  });
});

describe('computeTimingLadder — reused connection', () => {
  it('marks DNS / connect / TLS as reused, the exchange as elapsed', () => {
    const l = ladder({
      blocked: 0.3,
      _blocked_queueing: 0,
      dns: -1,
      connect: -1,
      ssl: -1,
      send: 0.3,
      wait: 45,
      receive: 12,
    });
    expect(states(l)).toEqual({
      queueing: 0,
      stalled: 0.3,
      dns: 'reused',
      connect: 'reused',
      ssl: 'reused',
      send: 0.3,
      wait: 45,
      receive: 12,
    });
  });
});

describe('computeTimingLadder — blocked / no response', () => {
  it('marks everything past Stalled as not-reached, with null Response/Ended', () => {
    const l = ladder(
      { blocked: 1.98, _blocked_queueing: 0, dns: -1, connect: -1, ssl: -1, send: 0, wait: 0, receive: 0 },
      { reachedResponse: false },
    );
    expect(states(l)).toEqual({
      queueing: 0,
      stalled: 1.98,
      dns: 'not-reached',
      connect: 'not-reached',
      ssl: 'not-reached',
      send: 'not-reached',
      wait: 'not-reached',
      receive: 'not-reached',
    });
    expect(l.responseMs).toBeNull();
    expect(l.endedMs).toBeNull();
    expect(l.durationMs).toBeCloseTo(1.98, 5);
  });
});

describe('computeTimingLadder — special cases', () => {
  it('marks TLS n/a on a plaintext http:// request', () => {
    const har = makeHar('http://openheaders.io/', {
      timings: { blocked: 1, _blocked_queueing: 0, dns: 10, connect: 20, ssl: -1, send: 1, wait: 50, receive: 30 },
    });
    const l = computeTimingLadder(har, { reachedResponse: true, isHttps: false });
    if (l == null) throw new Error('expected ladder');
    expect(l.rungs.find((r) => r.key === 'ssl')?.state).toEqual({ kind: 'na' });
    // connect with no TLS to subtract → the full connection is TCP.
    expect(l.rungs.find((r) => r.key === 'connect')?.state).toEqual({ kind: 'elapsed', ms: 20 });
  });

  it('uses the live Content Download override while streaming', () => {
    const l = ladder(NORMAL, { liveReceiveMs: 500 });
    expect(l.rungs.find((r) => r.key === 'receive')?.state).toEqual({ kind: 'elapsed', ms: 500 });
    expect(l.durationMs).toBe(685); // 225 − 40 + 500
  });

  it('flags the wire boundary on the right rungs', () => {
    const onWire = Object.fromEntries(ladder(NORMAL).rungs.map((r) => [r.key, r.onWire]));
    expect(onWire.queueing).toBe(false);
    expect(onWire.stalled).toBe(false);
    expect(onWire.dns).toBe(true);
    expect(onWire.receive).toBe(true);
  });

  it('returns null when the entry has no timings', () => {
    const har = { ...makeHar('https://openheaders.io/'), timings: undefined } as unknown as InspectorHarEntry;
    expect(computeTimingLadder(har, { reachedResponse: true, isHttps: true })).toBeNull();
  });
});
