/**
 * `HopCursor` — bridging state between `onBeforeRedirect` and the
 * matching `onSendHeaders`. The cursor tracks the per-`(tabId,
 * requestId)` hop index and the outgoing method known at each hop.
 * The correlator uses `consumePendingRecord` at `onSendHeaders` time
 * to stamp the new hop's URL into {@link InFlightFifo} with the
 * correct hop index (H8/H9).
 */

import { describe, expect, it, vi } from 'vitest';

import { HopCursor } from '../../src/correlator-heuristic/hop-cursor';
import { MAX_HOP_CURSORS_PER_TAB } from '../../src/correlator-heuristic/hop-cursor-constants';

const TAB = 7;

describe('HopCursor — start + currentHopIndex', () => {
  it('starts a fresh cursor at hop 0 with no pending record', () => {
    const cursor = new HopCursor();
    cursor.start(TAB, 'req-1', 'GET');
    expect(cursor.currentHopIndex(TAB, 'req-1')).toBe(0);
    expect(cursor.consumePendingRecord(TAB, 'req-1', 'GET')).toBeUndefined();
  });

  it('currentHopIndex is undefined for unknown lifecycles', () => {
    const cursor = new HopCursor();
    expect(cursor.currentHopIndex(TAB, 'unknown')).toBeUndefined();
  });

  it('start on the same key resets the cursor to hop 0', () => {
    const cursor = new HopCursor();
    cursor.start(TAB, 'req-1', 'GET');
    cursor.noteRedirect(TAB, 'req-1');
    expect(cursor.currentHopIndex(TAB, 'req-1')).toBe(1);
    cursor.start(TAB, 'req-1', 'POST');
    expect(cursor.currentHopIndex(TAB, 'req-1')).toBe(0);
    // The re-start clears the pending-redirect flag.
    expect(cursor.consumePendingRecord(TAB, 'req-1', 'POST')).toBeUndefined();
  });
});

describe('HopCursor — noteRedirect + consumePendingRecord', () => {
  it('noteRedirect bumps hopIndex and arms the pending record', () => {
    const cursor = new HopCursor();
    cursor.start(TAB, 'req-1', 'GET');
    cursor.noteRedirect(TAB, 'req-1');
    expect(cursor.currentHopIndex(TAB, 'req-1')).toBe(1);

    const pending = cursor.consumePendingRecord(TAB, 'req-1', 'GET');
    expect(pending).toEqual({ hopIndex: 1, method: 'GET' });
  });

  it('consumePendingRecord clears the flag — a second call returns undefined', () => {
    const cursor = new HopCursor();
    cursor.start(TAB, 'req-1', 'GET');
    cursor.noteRedirect(TAB, 'req-1');
    cursor.consumePendingRecord(TAB, 'req-1', 'GET');
    expect(cursor.consumePendingRecord(TAB, 'req-1', 'GET')).toBeUndefined();
  });

  it('303 method rewrite — consume captures the new method (POST → GET)', () => {
    const cursor = new HopCursor();
    cursor.start(TAB, 'req-1', 'POST');
    cursor.noteRedirect(TAB, 'req-1');
    // The outgoing method on the new hop is GET (303 rewrite).
    const pending = cursor.consumePendingRecord(TAB, 'req-1', 'GET');
    expect(pending).toEqual({ hopIndex: 1, method: 'GET' });
  });

  it('multiple redirects without intervening consume bump hopIndex monotonically', () => {
    const cursor = new HopCursor();
    cursor.start(TAB, 'req-1', 'GET');
    cursor.noteRedirect(TAB, 'req-1');
    cursor.noteRedirect(TAB, 'req-1');
    cursor.noteRedirect(TAB, 'req-1');
    expect(cursor.currentHopIndex(TAB, 'req-1')).toBe(3);
    // Pending flag stays set even across multiple noteRedirects — the
    // single consume returns the current hop count.
    expect(cursor.consumePendingRecord(TAB, 'req-1', 'GET')).toEqual({
      hopIndex: 3,
      method: 'GET',
    });
  });

  it('noteRedirect on an unknown lifecycle is a no-op', () => {
    const cursor = new HopCursor();
    cursor.noteRedirect(TAB, 'unknown');
    expect(cursor.currentHopIndex(TAB, 'unknown')).toBeUndefined();
  });

  it('consumePendingRecord on an unknown lifecycle returns undefined', () => {
    const cursor = new HopCursor();
    expect(cursor.consumePendingRecord(TAB, 'unknown', 'GET')).toBeUndefined();
  });

  it('hop-0 onSendHeaders does not trigger a record (no pending flag)', () => {
    const cursor = new HopCursor();
    cursor.start(TAB, 'req-1', 'GET');
    // No noteRedirect — onSendHeaders for hop 0 must report undefined
    // so the correlator's CORS path runs without double-recording the
    // hop-0 FIFO entry seeded at onBeforeRequest.
    expect(cursor.consumePendingRecord(TAB, 'req-1', 'GET')).toBeUndefined();
  });
});

describe('HopCursor — forget + forgetTab', () => {
  it('forget drops a single lifecycle without touching siblings', () => {
    const cursor = new HopCursor();
    cursor.start(TAB, 'req-1', 'GET');
    cursor.start(TAB, 'req-2', 'GET');
    cursor.forget(TAB, 'req-1');
    expect(cursor.currentHopIndex(TAB, 'req-1')).toBeUndefined();
    expect(cursor.currentHopIndex(TAB, 'req-2')).toBe(0);
  });

  it('forgetTab drops every lifecycle for the tab', () => {
    const cursor = new HopCursor();
    cursor.start(TAB, 'req-1', 'GET');
    cursor.start(TAB, 'req-2', 'GET');
    cursor.start(TAB + 1, 'req-sibling', 'GET');
    cursor.forgetTab(TAB);
    expect(cursor.currentHopIndex(TAB, 'req-1')).toBeUndefined();
    expect(cursor.currentHopIndex(TAB, 'req-2')).toBeUndefined();
    expect(cursor.currentHopIndex(TAB + 1, 'req-sibling')).toBe(0);
  });

  it('forgetTab fires onDrop with reason "tab-forgotten" per entry', () => {
    const onDrop = vi.fn();
    const cursor = new HopCursor({ onDrop });
    cursor.start(TAB, 'req-1', 'GET');
    cursor.start(TAB, 'req-2', 'GET');
    cursor.forgetTab(TAB);
    expect(onDrop).toHaveBeenCalledTimes(2);
    expect(onDrop.mock.calls.every((c) => c[0].reason === 'tab-forgotten')).toBe(true);
  });
});

describe('HopCursor — LRU cap', () => {
  it('drops the oldest cursor once the per-tab cap is exceeded', () => {
    const onDrop = vi.fn();
    const cursor = new HopCursor({ onDrop });
    for (let i = 0; i < MAX_HOP_CURSORS_PER_TAB; i++) {
      cursor.start(TAB, `req-${i}`, 'GET');
    }
    expect(cursor.size()).toBe(MAX_HOP_CURSORS_PER_TAB);

    cursor.start(TAB, 'req-extra', 'GET');
    expect(cursor.size()).toBe(MAX_HOP_CURSORS_PER_TAB);
    expect(cursor.currentHopIndex(TAB, 'req-0')).toBeUndefined();
    expect(cursor.currentHopIndex(TAB, 'req-extra')).toBe(0);
    expect(onDrop).toHaveBeenCalledTimes(1);
    expect(onDrop).toHaveBeenCalledWith({
      tabId: TAB,
      requestId: 'req-0',
      reason: 'lru',
    });
  });
});
