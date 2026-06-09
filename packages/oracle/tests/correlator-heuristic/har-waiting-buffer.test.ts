/**
 * `HarWaitingBuffer` — forward-race holding for HAR entries that
 * arrived before their matching `onBeforeRequest`.
 */

import type { InspectorHarEntry } from '@openheaders/core/types';
import { describe, expect, it, vi } from 'vitest';

import { HarWaitingBuffer } from '../../src/correlator-heuristic/har-waiting-buffer';
import { HAR_FORWARD_HOLD_MS, MAX_HAR_WAITING_PER_TAB } from '../../src/correlator-heuristic/late-arrival-constants';

const TAB = 9;
const URL_A = 'https://api.openheaders.io/x';
const URL_B = 'https://api.openheaders.io/y';
const T0 = 1_700_000_000_000;

function entry(method: string, url: string, startedAtMs: number): InspectorHarEntry {
  return {
    startedDateTime: new Date(startedAtMs).toISOString(),
    request: { method, url, headers: [], queryString: [] },
    response: { status: 200, statusText: 'OK', headers: [], content: { size: 0, mimeType: 'text/plain' } },
  };
}

describe('HarWaitingBuffer — hold / drain', () => {
  it('drain returns and removes entries the retry resolves', () => {
    const buf = new HarWaitingBuffer();
    const e1 = entry('GET', URL_A, T0);
    buf.hold(TAB, e1, T0);
    expect(buf.size()).toBe(1);

    const matched = buf.drain(TAB, () => ({ requestId: 'wr-1', hopIndex: 0 }));
    expect(matched).toHaveLength(1);
    expect(matched[0]?.requestId).toBe('wr-1');
    expect(matched[0]?.hopIndex).toBe(0);
    expect(matched[0]?.entry).toBe(e1);
    expect(buf.size()).toBe(0);
  });

  it('drain leaves unmatched entries in the buffer', () => {
    const buf = new HarWaitingBuffer();
    buf.hold(TAB, entry('GET', URL_A, T0), T0);
    buf.hold(TAB, entry('GET', URL_B, T0 + 5), T0 + 5);

    const matched = buf.drain(TAB, (e) => (e.request?.url === URL_A ? { requestId: 'wr-a', hopIndex: 0 } : undefined));
    expect(matched).toHaveLength(1);
    expect(matched[0]?.requestId).toBe('wr-a');
    expect(buf.size()).toBe(1);
  });

  it('drain preserves insertion order in the returned matches', () => {
    const buf = new HarWaitingBuffer();
    const first = entry('GET', URL_A, T0);
    const second = entry('GET', URL_B, T0 + 5);
    buf.hold(TAB, first, T0);
    buf.hold(TAB, second, T0 + 5);

    const matched = buf.drain(TAB, (e) =>
      e === first ? { requestId: 'wr-first', hopIndex: 0 } : { requestId: 'wr-second', hopIndex: 0 },
    );
    expect(matched.map((m) => m.requestId)).toEqual(['wr-first', 'wr-second']);
  });

  it('drain propagates the hopIndex returned by retry', () => {
    const buf = new HarWaitingBuffer();
    const e1 = entry('GET', URL_A, T0);
    const e2 = entry('GET', URL_B, T0 + 5);
    buf.hold(TAB, e1, T0);
    buf.hold(TAB, e2, T0 + 5);

    const matched = buf.drain(TAB, (e) =>
      e === e1 ? { requestId: 'wr-1', hopIndex: 0 } : { requestId: 'wr-1', hopIndex: 1 },
    );
    expect(matched.map((m) => m.hopIndex)).toEqual([0, 1]);
  });

  it('drain on an unknown tab returns an empty array', () => {
    const buf = new HarWaitingBuffer();
    expect(buf.drain(TAB, () => ({ requestId: 'wr-1', hopIndex: 0 }))).toEqual([]);
  });

  it('hold is per-tab — sibling tabs do not see each other', () => {
    const buf = new HarWaitingBuffer();
    buf.hold(TAB, entry('GET', URL_A, T0), T0);
    buf.hold(TAB + 1, entry('GET', URL_A, T0), T0);

    const matched = buf.drain(TAB, () => ({ requestId: 'wr-1', hopIndex: 0 }));
    expect(matched).toHaveLength(1);
    expect(buf.size()).toBe(1);
  });
});

describe('HarWaitingBuffer — gc', () => {
  it('removes and returns entries whose heldAtMs is past HAR_FORWARD_HOLD_MS', () => {
    const buf = new HarWaitingBuffer();
    const e = entry('GET', URL_A, T0);
    buf.hold(TAB, e, T0);
    const expired = buf.gc(T0 + HAR_FORWARD_HOLD_MS + 1);
    expect(buf.size()).toBe(0);
    expect(expired).toEqual([{ tabId: TAB, entry: e }]);
  });

  it('keeps entries that are still within the window', () => {
    const buf = new HarWaitingBuffer();
    buf.hold(TAB, entry('GET', URL_A, T0), T0);
    expect(buf.gc(T0 + HAR_FORWARD_HOLD_MS - 1)).toEqual([]);
    expect(buf.size()).toBe(1);
  });

  it('honors a per-entry hold override — short-fuse entries expire while default ones stay', () => {
    const buf = new HarWaitingBuffer();
    const short = entry('GET', URL_A, T0);
    const dflt = entry('GET', URL_B, T0);
    buf.hold(TAB, short, T0, 1_500);
    buf.hold(TAB, dflt, T0);
    const expired = buf.gc(T0 + 1_501);
    expect(expired).toEqual([{ tabId: TAB, entry: short }]);
    expect(buf.size()).toBe(1);
    expect(buf.gc(T0 + HAR_FORWARD_HOLD_MS + 1).map((x) => x.entry)).toEqual([dflt]);
  });

  it('returns expiries oldest-first and does NOT fire onDrop — the caller decides their fate', () => {
    const onDrop = vi.fn();
    const buf = new HarWaitingBuffer({ onDrop });
    const e1 = entry('GET', URL_A, T0);
    const e2 = entry('GET', URL_B, T0 + 10);
    buf.hold(TAB, e1, T0);
    buf.hold(TAB, e2, T0 + 10);
    const expired = buf.gc(T0 + 10 + HAR_FORWARD_HOLD_MS + 1);
    expect(expired.map((x) => x.entry)).toEqual([e1, e2]);
    expect(onDrop).not.toHaveBeenCalled();
  });
});

describe('HarWaitingBuffer — LRU cap', () => {
  it('drops the oldest entry once per-tab cap is exceeded', () => {
    const onDrop = vi.fn();
    const buf = new HarWaitingBuffer({ onDrop });
    // Stage `cap + 1` entries — the first deposit should evict.
    for (let i = 0; i <= MAX_HAR_WAITING_PER_TAB; i++) {
      buf.hold(TAB, entry('GET', `${URL_A}?i=${i}`, T0 + i), T0 + i);
    }
    expect(buf.size()).toBe(MAX_HAR_WAITING_PER_TAB);
    expect(onDrop).toHaveBeenCalledTimes(1);
    expect(onDrop.mock.calls[0][0]).toMatchObject({ tabId: TAB, reason: 'lru' });
  });
});

describe('HarWaitingBuffer — forgetTab', () => {
  it('drops every held entry for the tab', () => {
    const onDrop = vi.fn();
    const buf = new HarWaitingBuffer({ onDrop });
    buf.hold(TAB, entry('GET', URL_A, T0), T0);
    buf.hold(TAB, entry('GET', URL_B, T0 + 1), T0 + 1);
    buf.forgetTab(TAB);
    expect(buf.size()).toBe(0);
    expect(onDrop).toHaveBeenCalledTimes(2);
    expect(onDrop.mock.calls.every((c) => c[0].reason === 'tab-forgotten')).toBe(true);
  });

  it('leaves sibling tabs alone', () => {
    const buf = new HarWaitingBuffer();
    buf.hold(TAB, entry('GET', URL_A, T0), T0);
    buf.hold(TAB + 1, entry('GET', URL_A, T0), T0);
    buf.forgetTab(TAB);
    expect(buf.size()).toBe(1);
  });
});
