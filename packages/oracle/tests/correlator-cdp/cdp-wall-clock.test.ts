/**
 * `CdpWallClock` — the per-request wall↔monotonic offset tracker that lets
 * the CDP correlator stamp `completedAtMs` on the same wall clock as
 * `startedAtMs`.
 *
 * The pure conversion ({@link monotonicSecToWallMs}) and the stateful
 * offset capture / fallback / eviction are exercised directly here; the
 * end-to-end wall `completedAtMs` is asserted in `correlator-trace.test.ts`.
 */

import { logger } from '@openheaders/core/utils';
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';

import {
  CDP_WALL_RETENTION_MS,
  CdpWallClock,
  MAX_CDP_WALL_OFFSETS_PER_TAB,
  monotonicSecToWallMs,
} from '../../src/correlator-cdp/cdp-wall-clock';
import {
  cdpFinished,
  cdpRedirect,
  cdpStart,
  cdpWsClosed,
  cdpWsHandshakeRequest,
  PAGE_SESSION,
  type TraceCtx,
} from './builders';

const TAB = 31;
const CTX: TraceCtx = { tabId: TAB, requestId: 'cdp-1' };

/** The offset the canonical `cdpStart` implies: `wallTime − timestamp`. */
const OFFSET_SEC = 1_700_000_000 - 100;

describe('monotonicSecToWallMs — pure conversion', () => {
  it('adds the offset and scales to ms', () => {
    expect(monotonicSecToWallMs(100.9, OFFSET_SEC)).toBe(1_700_000_000_900);
  });

  it('keeps full sub-ms precision (the start-time sort needs it)', () => {
    const wall = monotonicSecToWallMs(100.56789, OFFSET_SEC);
    expect(wall).toBeCloseTo(1_700_000_000_567.89, 2);
    expect(Number.isInteger(wall)).toBe(false);
  });

  it('a zero offset returns the raw monotonic ms (the unknown-offset sentinel)', () => {
    expect(monotonicSecToWallMs(100.9, 0)).toBe(100_900);
  });
});

describe('CdpWallClock — offset capture', () => {
  it('records the per-request offset at requestWillBeSent and applies it to a later instant', () => {
    const clock = new CdpWallClock();
    clock.observe(cdpStart(CTX));
    // monotonic finish 100.9 → wall, the same clock as startedAtMs (1.7e12).
    expect(clock.toWallMs(TAB, PAGE_SESSION, CTX.requestId, 100.9)).toBe(1_700_000_000_900);
    expect(clock.size()).toBe(1);
  });

  it('keeps the offset fractional so a converted instant stays sub-ms accurate', () => {
    const clock = new CdpWallClock();
    // offset = 1_700_000_000.25 − 100 = 1_699_999_900.25
    clock.observe(cdpStart(CTX, { timestamp: 100, wallTime: 1_700_000_000.25 }));
    // (100.56789 + 1_699_999_900.25) * 1000 = 1_700_000_000_817.89, not an integer ms.
    const wall = clock.toWallMs(TAB, PAGE_SESSION, CTX.requestId, 100.56789);
    expect(wall).toBeCloseTo(1_700_000_000_817.89, 2);
    expect(Number.isInteger(wall)).toBe(false);
  });
});

describe('CdpWallClock — redirect continuation reuses the root offset (earliest wins)', () => {
  it('a continuation hop does not overwrite the root hop offset', () => {
    const clock = new CdpWallClock();
    clock.observe(cdpStart(CTX)); // offset = 1_699_999_900
    // The continuation reuses the same store id with a divergent offset
    // (wallTime not advancing in lock-step with timestamp). Earliest wins:
    // the whole chain's completedAtMs converts with the root's offset.
    clock.observe(
      cdpRedirect(
        CTX,
        { url: 'https://api.openheaders.io/users', status: 301, statusText: 'Moved Permanently' },
        'https://api.openheaders.io/v2/users',
        { timestamp: 100.1, wallTime: 1_700_000_005 }, // offset would be ~1_699_999_904.9
      ),
    );
    // Resolves with the ROOT offset (1_699_999_900), not the continuation's.
    expect(clock.toWallMs(TAB, PAGE_SESSION, CTX.requestId, 100.9)).toBe(1_700_000_000_900);
    expect(clock.size()).toBe(1);
  });
});

describe('CdpWallClock — fallback resolution', () => {
  let warn: MockInstance;
  beforeEach(() => {
    warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('falls back to the tab-global last-known offset for a request whose start was never seen', () => {
    const clock = new CdpWallClock();
    clock.observe(cdpStart(CTX)); // seeds lastOffsetSec for the tab
    // A different request id on the same tab — CDP attached mid-flight, so its
    // requestWillBeSent was missed. The tab-global offset stands in.
    expect(clock.toWallMs(TAB, PAGE_SESSION, 'never-seen', 100.9)).toBe(1_700_000_000_900);
    expect(warn).not.toHaveBeenCalled();
  });

  it('falls back to a zero offset with a one-time warning when no offset is known at all', () => {
    const clock = new CdpWallClock();
    // No requestWillBeSent ever observed on this tab → raw monotonic ms.
    expect(clock.toWallMs(TAB, PAGE_SESSION, 'first-event', 100.9)).toBe(100_900);
    expect(clock.toWallMs(TAB, PAGE_SESSION, 'second-event', 200.5)).toBe(200_500);
    // Warned once, not per miss.
    expect(warn).toHaveBeenCalledTimes(1);
  });
});

describe('CdpWallClock — bounded state', () => {
  it('caps per-tab offsets, evicting oldest-inserted first', () => {
    const clock = new CdpWallClock();
    for (let i = 0; i < MAX_CDP_WALL_OFFSETS_PER_TAB + 5; i++) {
      clock.observe(cdpStart({ tabId: TAB, requestId: `req-${i}` }));
    }
    expect(clock.size()).toBe(MAX_CDP_WALL_OFFSETS_PER_TAB);
  });

  it('sweeps a finalized offset after the retention window elapses', () => {
    const clock = new CdpWallClock();
    clock.observe(cdpStart(CTX));
    clock.observe(cdpFinished(CTX)); // finalized at monotonic 100.9 s → 100_900 ms
    expect(clock.size()).toBe(1);
    // A later event on the tab, past the retention window, triggers the sweep.
    const laterSec = 100.9 + CDP_WALL_RETENTION_MS / 1000 + 1;
    clock.observe(cdpStart({ tabId: TAB, requestId: 'cdp-2' }, { timestamp: laterSec }));
    // The finalized cdp-1 was swept; only cdp-2 remains, its offset intact
    // (converting cdp-2's own start instant returns its wall start).
    expect(clock.size()).toBe(1);
    expect(clock.toWallMs(TAB, PAGE_SESSION, 'cdp-2', laterSec)).toBe(1_700_000_000_000);
  });

  it('forgetTab drops a tab; clear drops everything', () => {
    const clock = new CdpWallClock();
    clock.observe(cdpStart(CTX));
    clock.observe(cdpStart({ tabId: 99, requestId: 'other' }));
    expect(clock.size()).toBe(2);
    clock.forgetTab(TAB);
    expect(clock.size()).toBe(1);
    clock.clear();
    expect(clock.size()).toBe(0);
  });
});

describe('CdpWallClock — per-tab isolation', () => {
  it('does not resolve one tab offset against another tab', () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    const clock = new CdpWallClock();
    clock.observe(cdpStart(CTX)); // tab 31 only
    // Tab 99 has no offset at all → zero-offset sentinel, not tab 31's offset.
    expect(clock.toWallMs(99, PAGE_SESSION, 'x', 100.9)).toBe(100_900);
    expect(warn).toHaveBeenCalledTimes(1);
    vi.restoreAllMocks();
  });
});

describe('CdpWallClock — WebSocket handshake pair', () => {
  it('learns the per-socket offset from webSocketWillSendHandshakeRequest', () => {
    const clock = new CdpWallClock();
    const ctx: TraceCtx = { tabId: 9, requestId: 'ws-1' };
    clock.observe(cdpWsHandshakeRequest(ctx, { timestamp: 100, wallTime: 1_700_000_000 }));
    // A frame instant resolves through the socket's own offset.
    expect(clock.toWallMs(9, PAGE_SESSION, 'ws-1', 101)).toBeCloseTo((101 + (1_700_000_000 - 100)) * 1000, 6);
  });

  it('marks the socket finalized at webSocketClosed (retention gc applies)', () => {
    const clock = new CdpWallClock();
    const ctx: TraceCtx = { tabId: 9, requestId: 'ws-1' };
    clock.observe(cdpWsHandshakeRequest(ctx, { timestamp: 100, wallTime: 1_700_000_000 }));
    clock.observe(cdpWsClosed(ctx, { timestamp: 102 }));
    expect(clock.size()).toBe(1);
    // A later event past the retention window sweeps the finalized offset.
    clock.observe(
      cdpWsHandshakeRequest({ tabId: 9, requestId: 'ws-2' }, { timestamp: 102 + 61, wallTime: 1_700_000_061 }),
    );
    expect(clock.size()).toBe(1);
  });
});
