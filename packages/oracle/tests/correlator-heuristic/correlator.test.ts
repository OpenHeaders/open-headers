/**
 * `HeuristicCorrelator` driven by in-memory event sources.
 *
 * Mirrors the CDP stub's tests one-for-one (attach gate, subscribe,
 * detach, dispose) — the symmetry proves the {@link RequestCorrelator}
 * contract is satisfied by both strategies. Extended in H2/H3 with
 * HAR-flow scenarios covering the closest-timestamp join, body
 * attachment, and per-tab forget.
 */

import type {
  RequestLifecycle,
  RequestLifecycleListener,
  RequestLifecycleUpdate,
} from '@openheaders/core/request-lifecycle';
import type { InspectorHarBody, InspectorHarEntry } from '@openheaders/core/types';
import { describe, expect, it, vi } from 'vitest';

import { HeuristicCorrelator } from '../../src/correlator-heuristic/correlator';
import type { WebRequestEvent, WebRequestEventSource } from '../../src/correlator-heuristic/events';
import type { HarEvent, HarEventSource } from '../../src/correlator-heuristic/har-events';
import type { OverrideEvent, OverrideEventSource } from '../../src/correlator-heuristic/override-events';
import { FINALIZED_RETENTION_MS, HAR_FORWARD_HOLD_MS } from '../../src/correlator-heuristic/late-arrival-constants';
import { reduce } from '../../src/request-lifecycle-store/reducer';

/** In-memory webRequest source for tests. */
class TestWebRequestSource implements WebRequestEventSource {
  private readonly listeners = new Set<(event: WebRequestEvent) => void>();

  subscribe(listener: (event: WebRequestEvent) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  emit(event: WebRequestEvent): void {
    for (const fn of this.listeners) fn(event);
  }

  listenerCount(): number {
    return this.listeners.size;
  }
}

/** In-memory HAR source for tests. */
class TestHarSource implements HarEventSource {
  private readonly listeners = new Set<(event: HarEvent) => void>();

  subscribe(listener: (event: HarEvent) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  emit(event: HarEvent): void {
    for (const fn of this.listeners) fn(event);
  }

  listenerCount(): number {
    return this.listeners.size;
  }
}

/** In-memory override source for tests. */
class TestOverrideSource implements OverrideEventSource {
  private readonly listeners = new Set<(event: OverrideEvent) => void>();

  subscribe(listener: (event: OverrideEvent) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  emit(event: OverrideEvent): void {
    for (const fn of this.listeners) fn(event);
  }
}

function makeSources(): { webRequest: TestWebRequestSource; har: TestHarSource } {
  return { webRequest: new TestWebRequestSource(), har: new TestHarSource() };
}

const TAB = 11;
const URL_A = 'https://api.openheaders.io/x';
const URL_B = 'https://api.openheaders.io/y';
const STARTED_AT_MS = 1_700_000_000_000;
const STARTED_AT_ISO = new Date(STARTED_AT_MS).toISOString();

const startEvent: WebRequestEvent = {
  method_kind: 'onBeforeRequest',
  tabId: TAB,
  requestId: 'wr-1',
  url: URL_A,
  method: 'GET',
  type: 'xmlhttprequest',
  timeStamp: STARTED_AT_MS,
};

function harEntry(overrides?: Partial<InspectorHarEntry>): InspectorHarEntry {
  const base: InspectorHarEntry = {
    startedDateTime: STARTED_AT_ISO,
    request: {
      method: 'GET',
      url: URL_A,
      headers: [],
      queryString: [],
    },
    response: {
      status: 200,
      statusText: 'OK',
      headers: [],
      content: { size: 0, mimeType: 'text/plain' },
    },
  };
  return { ...base, ...overrides };
}

function harBody(overrides?: Partial<InspectorHarBody>): InspectorHarBody {
  return {
    method: 'GET',
    url: URL_A,
    startedDateTime: STARTED_AT_ISO,
    content: 'body',
    encoding: '',
    ...overrides,
  };
}

describe('HeuristicCorrelator — attach gate', () => {
  it('does not emit before any tab is attached', () => {
    const { webRequest, har } = makeSources();
    const correlator = new HeuristicCorrelator({ webRequest, har });
    const listener: RequestLifecycleListener = vi.fn();
    correlator.subscribe(listener);
    webRequest.emit(startEvent);
    expect(listener).not.toHaveBeenCalled();
    correlator.dispose();
  });

  it('emits the mapped update for an attached tab', () => {
    const { webRequest, har } = makeSources();
    const correlator = new HeuristicCorrelator({ webRequest, har });
    const collected: RequestLifecycleUpdate[] = [];
    correlator.subscribe((u) => collected.push(u));
    correlator.attachTab(TAB);
    webRequest.emit(startEvent);
    expect(collected).toHaveLength(1);
    expect(collected[0]?.kind).toBe('started');
    correlator.dispose();
  });

  it('detachTab stops further emissions for that tab', () => {
    const { webRequest, har } = makeSources();
    const correlator = new HeuristicCorrelator({ webRequest, har });
    const fn = vi.fn();
    correlator.subscribe(fn);
    correlator.attachTab(TAB);
    webRequest.emit(startEvent);
    correlator.detachTab(TAB);
    webRequest.emit({ ...startEvent, requestId: 'wr-2' });
    expect(fn).toHaveBeenCalledTimes(1);
    correlator.dispose();
  });

  it('attachTab is idempotent and tab-scoped', () => {
    const { webRequest, har } = makeSources();
    const correlator = new HeuristicCorrelator({ webRequest, har });
    const fn = vi.fn();
    correlator.subscribe(fn);
    correlator.attachTab(TAB);
    correlator.attachTab(TAB);
    webRequest.emit(startEvent);
    expect(fn).toHaveBeenCalledTimes(1);
    webRequest.emit({ ...startEvent, tabId: TAB + 1, requestId: 'wr-3' });
    expect(fn).toHaveBeenCalledTimes(1);
    correlator.dispose();
  });
});

describe('HeuristicCorrelator — subscribe / dispose', () => {
  it('multiple subscribers each receive every emitted update', () => {
    const { webRequest, har } = makeSources();
    const correlator = new HeuristicCorrelator({ webRequest, har });
    const a = vi.fn();
    const b = vi.fn();
    correlator.subscribe(a);
    correlator.subscribe(b);
    correlator.attachTab(TAB);
    webRequest.emit(startEvent);
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
    correlator.dispose();
  });

  it('subscribe returns an Unsubscribe that removes the listener', () => {
    const { webRequest, har } = makeSources();
    const correlator = new HeuristicCorrelator({ webRequest, har });
    const fn = vi.fn();
    const off = correlator.subscribe(fn);
    correlator.attachTab(TAB);
    off();
    webRequest.emit(startEvent);
    expect(fn).not.toHaveBeenCalled();
    correlator.dispose();
  });

  it('dispose unsubscribes from both sources and clears state', () => {
    const { webRequest, har } = makeSources();
    const correlator = new HeuristicCorrelator({ webRequest, har });
    const fn = vi.fn();
    correlator.subscribe(fn);
    correlator.attachTab(TAB);
    correlator.dispose();
    expect(webRequest.listenerCount()).toBe(0);
    expect(har.listenerCount()).toBe(0);
    webRequest.emit(startEvent);
    expect(fn).not.toHaveBeenCalled();
  });
});

describe('HeuristicCorrelator — HAR ↔ requestId join (H2/H3)', () => {
  it('emits har-attached after a matching webRequest start', () => {
    const { webRequest, har } = makeSources();
    const correlator = new HeuristicCorrelator({ webRequest, har });
    const collected: RequestLifecycleUpdate[] = [];
    correlator.subscribe((u) => collected.push(u));
    correlator.attachTab(TAB);
    webRequest.emit(startEvent);
    har.emit({ kind: 'har-entry', tabId: TAB, entry: harEntry() });

    const attached = collected.find((u) => u.kind === 'har-attached');
    expect(attached).toBeDefined();
    if (attached?.kind !== 'har-attached') throw new Error('expected har-attached');
    expect(attached.requestId).toBe('wr-1');
    expect(attached.hopIndex).toBe(0);
  });

  it('drops HAR entries with no matching in-flight observation', () => {
    const { webRequest, har } = makeSources();
    const correlator = new HeuristicCorrelator({ webRequest, har });
    const collected: RequestLifecycleUpdate[] = [];
    correlator.subscribe((u) => collected.push(u));
    correlator.attachTab(TAB);
    har.emit({ kind: 'har-entry', tabId: TAB, entry: harEntry() });
    expect(collected.filter((u) => u.kind === 'har-attached')).toHaveLength(0);
  });

  it('drops HAR entries on tabs that are not attached', () => {
    const { webRequest, har } = makeSources();
    const correlator = new HeuristicCorrelator({ webRequest, har });
    const fn = vi.fn();
    correlator.subscribe(fn);
    har.emit({ kind: 'har-entry', tabId: TAB, entry: harEntry() });
    expect(fn).not.toHaveBeenCalled();
  });

  it('drops HAR entries with malformed startedDateTime', () => {
    const { webRequest, har } = makeSources();
    const correlator = new HeuristicCorrelator({ webRequest, har });
    const collected: RequestLifecycleUpdate[] = [];
    correlator.subscribe((u) => collected.push(u));
    correlator.attachTab(TAB);
    webRequest.emit(startEvent);
    har.emit({
      kind: 'har-entry',
      tabId: TAB,
      entry: harEntry({ startedDateTime: 'not-a-date' }),
    });
    expect(collected.filter((u) => u.kind === 'har-attached')).toHaveLength(0);
  });

  it('method gate: POST HAR for a URL with only a GET in-flight finds no match', () => {
    const { webRequest, har } = makeSources();
    const correlator = new HeuristicCorrelator({ webRequest, har });
    const collected: RequestLifecycleUpdate[] = [];
    correlator.subscribe((u) => collected.push(u));
    correlator.attachTab(TAB);
    webRequest.emit({ ...startEvent, method: 'GET' });
    har.emit({
      kind: 'har-entry',
      tabId: TAB,
      entry: harEntry({
        request: { method: 'POST', url: URL_A, headers: [], queryString: [] },
      }),
    });
    expect(collected.filter((u) => u.kind === 'har-attached')).toHaveLength(0);
  });

  it('closest-timestamp wins when two redirect hops share a target URL', () => {
    const { webRequest, har } = makeSources();
    const correlator = new HeuristicCorrelator({ webRequest, har });
    const collected: RequestLifecycleUpdate[] = [];
    correlator.subscribe((u) => collected.push(u));
    correlator.attachTab(TAB);
    // Two separate requests to the same URL B, 50ms apart.
    webRequest.emit({ ...startEvent, requestId: 'wr-1', url: URL_B, timeStamp: STARTED_AT_MS });
    webRequest.emit({ ...startEvent, requestId: 'wr-2', url: URL_B, timeStamp: STARTED_AT_MS + 50 });
    // HAR for the *second* request arrives first; closest-t should
    // pick wr-2.
    har.emit({
      kind: 'har-entry',
      tabId: TAB,
      entry: harEntry({
        startedDateTime: new Date(STARTED_AT_MS + 48).toISOString(),
        request: { method: 'GET', url: URL_B, headers: [], queryString: [] },
      }),
    });
    const first = collected.find((u) => u.kind === 'har-attached');
    if (first?.kind !== 'har-attached') throw new Error('expected har-attached');
    expect(first.requestId).toBe('wr-2');

    // Then the HAR for the first request arrives; it must pick wr-1
    // (the only one left).
    har.emit({
      kind: 'har-entry',
      tabId: TAB,
      entry: harEntry({
        startedDateTime: new Date(STARTED_AT_MS + 1).toISOString(),
        request: { method: 'GET', url: URL_B, headers: [], queryString: [] },
      }),
    });
    const second = collected.filter((u) => u.kind === 'har-attached')[1];
    if (second?.kind !== 'har-attached') throw new Error('expected har-attached');
    expect(second.requestId).toBe('wr-1');
  });
});

describe('HeuristicCorrelator — body attachment', () => {
  it('emits body-attached after a matching har-attached', () => {
    const { webRequest, har } = makeSources();
    const correlator = new HeuristicCorrelator({ webRequest, har });
    const collected: RequestLifecycleUpdate[] = [];
    correlator.subscribe((u) => collected.push(u));
    correlator.attachTab(TAB);
    webRequest.emit(startEvent);
    har.emit({ kind: 'har-entry', tabId: TAB, entry: harEntry() });
    har.emit({ kind: 'har-body', tabId: TAB, body: harBody() });

    const body = collected.find((u) => u.kind === 'body-attached');
    if (body?.kind !== 'body-attached') throw new Error('expected body-attached');
    expect(body.requestId).toBe('wr-1');
    expect(body.hopIndex).toBe(0);
  });

  it('drops bodies that arrive before their entry', () => {
    const { webRequest, har } = makeSources();
    const correlator = new HeuristicCorrelator({ webRequest, har });
    const collected: RequestLifecycleUpdate[] = [];
    correlator.subscribe((u) => collected.push(u));
    correlator.attachTab(TAB);
    webRequest.emit(startEvent);
    har.emit({ kind: 'har-body', tabId: TAB, body: harBody() });
    expect(collected.filter((u) => u.kind === 'body-attached')).toHaveLength(0);
  });

  it('a second body for the same key is a silent miss (consume-on-lookup)', () => {
    const { webRequest, har } = makeSources();
    const correlator = new HeuristicCorrelator({ webRequest, har });
    const collected: RequestLifecycleUpdate[] = [];
    correlator.subscribe((u) => collected.push(u));
    correlator.attachTab(TAB);
    webRequest.emit(startEvent);
    har.emit({ kind: 'har-entry', tabId: TAB, entry: harEntry() });
    har.emit({ kind: 'har-body', tabId: TAB, body: harBody() });
    har.emit({ kind: 'har-body', tabId: TAB, body: harBody() });
    expect(collected.filter((u) => u.kind === 'body-attached')).toHaveLength(1);
  });
});

describe('HeuristicCorrelator — detach clears HAR-side state', () => {
  it('detachTab forgets in-flight and body-join state for that tab', () => {
    const { webRequest, har } = makeSources();
    const correlator = new HeuristicCorrelator({ webRequest, har });
    const collected: RequestLifecycleUpdate[] = [];
    correlator.subscribe((u) => collected.push(u));
    correlator.attachTab(TAB);
    webRequest.emit(startEvent);
    har.emit({ kind: 'har-entry', tabId: TAB, entry: harEntry() });
    expect(collected.some((u) => u.kind === 'har-attached')).toBe(true);

    correlator.detachTab(TAB);
    correlator.attachTab(TAB);
    // After detach + re-attach, the body-join map must be empty: a
    // body for the previously-attached entry must NOT produce an
    // update (invariant 2 — lifecycles die with the tab).
    har.emit({ kind: 'har-body', tabId: TAB, body: harBody() });
    expect(collected.filter((u) => u.kind === 'body-attached')).toHaveLength(0);
  });
});

describe('HeuristicCorrelator — H7 forward race (HAR before onBeforeRequest)', () => {
  it('attaches a HAR entry that arrived before the matching webRequest start', () => {
    const { webRequest, har } = makeSources();
    const correlator = new HeuristicCorrelator({ webRequest, har });
    const collected: RequestLifecycleUpdate[] = [];
    correlator.subscribe((u) => collected.push(u));
    correlator.attachTab(TAB);

    // HAR lands first — buffered, no attachment yet.
    har.emit({ kind: 'har-entry', tabId: TAB, entry: harEntry() });
    expect(collected.filter((u) => u.kind === 'har-attached')).toHaveLength(0);

    // Matching onBeforeRequest arrives within the window — drains.
    webRequest.emit(startEvent);

    const attached = collected.find((u) => u.kind === 'har-attached');
    if (attached?.kind !== 'har-attached') throw new Error('expected har-attached');
    expect(attached.requestId).toBe('wr-1');
    correlator.dispose();
  });

  it('drops a HAR entry whose hold window elapses before any match arrives', () => {
    const { webRequest, har } = makeSources();
    const correlator = new HeuristicCorrelator({ webRequest, har });
    const collected: RequestLifecycleUpdate[] = [];
    correlator.subscribe((u) => collected.push(u));
    correlator.attachTab(TAB);

    har.emit({ kind: 'har-entry', tabId: TAB, entry: harEntry() });
    // Some other request comes along past the window — its timeStamp
    // ticks the gc clock and the held entry expires.
    webRequest.emit({
      ...startEvent,
      requestId: 'wr-other',
      url: 'https://api.openheaders.io/other',
      timeStamp: STARTED_AT_MS + HAR_FORWARD_HOLD_MS + 100,
    });
    // Now the matching onBeforeRequest finally arrives — too late.
    webRequest.emit({
      ...startEvent,
      timeStamp: STARTED_AT_MS + HAR_FORWARD_HOLD_MS + 200,
    });

    expect(collected.filter((u) => u.kind === 'har-attached')).toHaveLength(0);
    correlator.dispose();
  });

  it('drains only the matching held entry — siblings stay buffered', () => {
    const { webRequest, har } = makeSources();
    const correlator = new HeuristicCorrelator({ webRequest, har });
    const collected: RequestLifecycleUpdate[] = [];
    correlator.subscribe((u) => collected.push(u));
    correlator.attachTab(TAB);

    har.emit({ kind: 'har-entry', tabId: TAB, entry: harEntry() });
    har.emit({
      kind: 'har-entry',
      tabId: TAB,
      entry: harEntry({
        startedDateTime: new Date(STARTED_AT_MS + 10).toISOString(),
        request: { method: 'GET', url: URL_B, headers: [], queryString: [] },
      }),
    });
    // Only the URL_A request arrives.
    webRequest.emit(startEvent);

    const attached = collected.filter((u) => u.kind === 'har-attached');
    expect(attached).toHaveLength(1);
    if (attached[0]?.kind !== 'har-attached') throw new Error('expected har-attached');
    expect(attached[0].requestId).toBe('wr-1');
    correlator.dispose();
  });
});

describe('HeuristicCorrelator — H7 backward retention (HAR after terminal phase)', () => {
  it('attaches a HAR that arrives after onCompleted but within the window', () => {
    const { webRequest, har } = makeSources();
    const correlator = new HeuristicCorrelator({ webRequest, har });
    const collected: RequestLifecycleUpdate[] = [];
    correlator.subscribe((u) => collected.push(u));
    correlator.attachTab(TAB);

    webRequest.emit(startEvent);
    webRequest.emit({
      method_kind: 'onCompleted',
      tabId: TAB,
      requestId: 'wr-1',
      url: URL_A,
      method: 'GET',
      type: 'xmlhttprequest',
      timeStamp: STARTED_AT_MS + 50,
      statusCode: 200,
    });

    // HAR arrives within window — `recentLifecycles` still holds wr-1.
    har.emit({
      kind: 'har-entry',
      tabId: TAB,
      entry: harEntry({
        startedDateTime: new Date(STARTED_AT_MS + 100).toISOString(),
      }),
    });

    expect(collected.filter((u) => u.kind === 'har-attached')).toHaveLength(1);
    correlator.dispose();
  });

  it('attaches a HAR delivered tens of seconds after a slow completion', () => {
    // Regression: on slow/offline networks the devtools HAR pipeline can
    // deliver `onRequestFinished` far later than webRequest's
    // `onCompleted`. Retention is pinned to the in-flight join-key
    // lifetime (measured from finish), so a delivery lag an order of
    // magnitude past the short forward-hold window — but within that
    // lifetime — still attaches.
    expect(FINALIZED_RETENTION_MS).toBeGreaterThan(HAR_FORWARD_HOLD_MS * 2);
    const { webRequest, har } = makeSources();
    const correlator = new HeuristicCorrelator({ webRequest, har });
    const collected: RequestLifecycleUpdate[] = [];
    correlator.subscribe((u) => collected.push(u));
    correlator.attachTab(TAB);

    const completedAt = STARTED_AT_MS + 8_000;
    webRequest.emit(startEvent);
    webRequest.emit({
      method_kind: 'onCompleted',
      tabId: TAB,
      requestId: 'wr-1',
      url: URL_A,
      method: 'GET',
      type: 'xmlhttprequest',
      timeStamp: completedAt,
      statusCode: 200,
    });
    // Unrelated traffic advances the gc clock to nearly a full retention
    // window past completion — comfortably past the old short window, yet
    // wr-1 is retained because its join key is still poppable.
    webRequest.emit({
      ...startEvent,
      requestId: 'wr-other',
      url: 'https://api.openheaders.io/other',
      timeStamp: completedAt + FINALIZED_RETENTION_MS - 1_000,
    });
    // Late HAR for wr-1; its `startedDateTime` still reflects the request
    // start, so popMatching resolves the in-flight slot and the retained
    // lifecycle takes the attachment.
    har.emit({
      kind: 'har-entry',
      tabId: TAB,
      entry: harEntry({ startedDateTime: new Date(STARTED_AT_MS + 100).toISOString() }),
    });

    const attached = collected.filter((u) => u.kind === 'har-attached');
    expect(attached).toHaveLength(1);
    if (attached[0]?.kind !== 'har-attached') throw new Error('expected har-attached');
    expect(attached[0].requestId).toBe('wr-1');
    correlator.dispose();
  });

  it('drops a HAR that arrives past the retention window after terminal', () => {
    const { webRequest, har } = makeSources();
    const correlator = new HeuristicCorrelator({ webRequest, har });
    const collected: RequestLifecycleUpdate[] = [];
    correlator.subscribe((u) => collected.push(u));
    correlator.attachTab(TAB);

    webRequest.emit(startEvent);
    webRequest.emit({
      method_kind: 'onCompleted',
      tabId: TAB,
      requestId: 'wr-1',
      url: URL_A,
      method: 'GET',
      type: 'xmlhttprequest',
      timeStamp: STARTED_AT_MS + 50,
      statusCode: 200,
    });
    // Another tab event ticks the gc clock past the window.
    webRequest.emit({
      ...startEvent,
      requestId: 'wr-other',
      url: 'https://api.openheaders.io/other',
      timeStamp: STARTED_AT_MS + 50 + FINALIZED_RETENTION_MS + 100,
    });
    // Late HAR whose `startedDateTime` is still near the request start —
    // its in-flight join key is well within IN_FLIGHT_MAX_AGE_MS, so
    // popMatching resolves wr-1; the drop is solely because
    // recentLifecycles pruned wr-1 once its retention window elapsed.
    har.emit({
      kind: 'har-entry',
      tabId: TAB,
      entry: harEntry({
        startedDateTime: new Date(STARTED_AT_MS + 100).toISOString(),
      }),
    });

    expect(collected.filter((u) => u.kind === 'har-attached')).toHaveLength(0);
    correlator.dispose();
  });

  it('failed phase also opens the retention window', () => {
    const { webRequest, har } = makeSources();
    const correlator = new HeuristicCorrelator({ webRequest, har });
    const collected: RequestLifecycleUpdate[] = [];
    correlator.subscribe((u) => collected.push(u));
    correlator.attachTab(TAB);

    webRequest.emit(startEvent);
    webRequest.emit({
      method_kind: 'onErrorOccurred',
      tabId: TAB,
      requestId: 'wr-1',
      url: URL_A,
      method: 'GET',
      type: 'xmlhttprequest',
      timeStamp: STARTED_AT_MS + 50,
      error: 'net::ERR_FAILED',
    });

    har.emit({
      kind: 'har-entry',
      tabId: TAB,
      entry: harEntry({ startedDateTime: new Date(STARTED_AT_MS + 100).toISOString() }),
    });

    expect(collected.filter((u) => u.kind === 'har-attached')).toHaveLength(1);
    correlator.dispose();
  });

  it('expiring one terminal lifecycle does not affect siblings still in-window', () => {
    const { webRequest, har } = makeSources();
    const correlator = new HeuristicCorrelator({ webRequest, har });
    const collected: RequestLifecycleUpdate[] = [];
    correlator.subscribe((u) => collected.push(u));
    correlator.attachTab(TAB);

    // wr-1 completes at T0+50.
    webRequest.emit(startEvent);
    webRequest.emit({
      method_kind: 'onCompleted',
      tabId: TAB,
      requestId: 'wr-1',
      url: URL_A,
      method: 'GET',
      type: 'xmlhttprequest',
      timeStamp: STARTED_AT_MS + 50,
      statusCode: 200,
    });
    // wr-2 completes much later — still within its own window when
    // wr-1 falls out.
    webRequest.emit({
      ...startEvent,
      requestId: 'wr-2',
      url: URL_B,
      timeStamp: STARTED_AT_MS + FINALIZED_RETENTION_MS,
    });
    webRequest.emit({
      method_kind: 'onCompleted',
      tabId: TAB,
      requestId: 'wr-2',
      url: URL_B,
      method: 'GET',
      type: 'xmlhttprequest',
      timeStamp: STARTED_AT_MS + FINALIZED_RETENTION_MS + 50,
      statusCode: 200,
    });
    // Another event ticks gc past wr-1's window but not wr-2's.
    webRequest.emit({
      ...startEvent,
      requestId: 'wr-3',
      url: 'https://api.openheaders.io/z',
      timeStamp: STARTED_AT_MS + FINALIZED_RETENTION_MS + 100,
    });
    // HAR for wr-2 — should still attach.
    har.emit({
      kind: 'har-entry',
      tabId: TAB,
      entry: harEntry({
        startedDateTime: new Date(STARTED_AT_MS + FINALIZED_RETENTION_MS).toISOString(),
        request: { method: 'GET', url: URL_B, headers: [], queryString: [] },
      }),
    });

    const attached = collected.filter((u) => u.kind === 'har-attached');
    expect(attached).toHaveLength(1);
    if (attached[0]?.kind !== 'har-attached') throw new Error('expected har-attached');
    expect(attached[0].requestId).toBe('wr-2');
    correlator.dispose();
  });
});

describe('HeuristicCorrelator — H7 tab scope', () => {
  it('detachTab clears both H7 buffers without touching siblings', () => {
    const { webRequest, har } = makeSources();
    const correlator = new HeuristicCorrelator({ webRequest, har });
    const collected: RequestLifecycleUpdate[] = [];
    correlator.subscribe((u) => collected.push(u));
    correlator.attachTab(TAB);
    correlator.attachTab(TAB + 1);

    // Hold a HAR for TAB and finalize a lifecycle on TAB.
    har.emit({ kind: 'har-entry', tabId: TAB, entry: harEntry() });
    webRequest.emit({ ...startEvent, tabId: TAB + 1, requestId: 'wr-sibling' });

    correlator.detachTab(TAB);
    // After detach, a matching onBeforeRequest for TAB must not
    // attach the previously-held HAR (buffer was cleared on detach).
    correlator.attachTab(TAB);
    webRequest.emit(startEvent);

    expect(collected.filter((u) => u.kind === 'har-attached')).toHaveLength(0);
    correlator.dispose();
  });
});

// H5 CORS classification: the verdict is engine-internal
// (correlator-heuristic/cors-types.ts) and never travels on the wire.
// The H6 describe block below asserts the only observable downstream
// effect — ERR_FAILED refinement on `error.code`.

describe('HeuristicCorrelator — H6 error refinement on terminal phase', () => {
  const APP_ORIGIN = 'https://app.openheaders.io';

  it('refines net::ERR_FAILED to oh:cors-missing-acao when the verdict says so', () => {
    const { webRequest, har } = makeSources();
    const correlator = new HeuristicCorrelator({ webRequest, har });
    const collected: RequestLifecycleUpdate[] = [];
    correlator.subscribe((u) => collected.push(u));
    correlator.attachTab(TAB);

    webRequest.emit(startEvent);
    webRequest.emit({
      method_kind: 'onSendHeaders',
      tabId: TAB,
      requestId: 'wr-1',
      url: URL_A,
      method: 'GET',
      type: 'xmlhttprequest',
      timeStamp: STARTED_AT_MS + 1,
      requestHeaders: [{ name: 'Origin', value: APP_ORIGIN }],
    });
    webRequest.emit({
      method_kind: 'onHeadersReceived',
      tabId: TAB,
      requestId: 'wr-1',
      url: URL_A,
      method: 'GET',
      type: 'xmlhttprequest',
      timeStamp: STARTED_AT_MS + 2,
      statusCode: 0,
      responseHeaders: [],
    });
    webRequest.emit({
      method_kind: 'onErrorOccurred',
      tabId: TAB,
      requestId: 'wr-1',
      url: URL_A,
      method: 'GET',
      type: 'xmlhttprequest',
      timeStamp: STARTED_AT_MS + 50,
      error: 'net::ERR_FAILED',
    });

    const failed = collected.find((u) => u.kind === 'phase' && u.patch.phase === 'failed');
    if (failed?.kind !== 'phase') throw new Error('expected failed phase');
    expect(failed.patch.error?.code).toBe('oh:cors-missing-acao');
    expect(failed.patch.error?.reason).toBe('net::ERR_FAILED');
    correlator.dispose();
  });

  it('refines net::ERR_FAILED to oh:cors-origin-mismatch when ACAO disagrees', () => {
    const { webRequest, har } = makeSources();
    const correlator = new HeuristicCorrelator({ webRequest, har });
    const collected: RequestLifecycleUpdate[] = [];
    correlator.subscribe((u) => collected.push(u));
    correlator.attachTab(TAB);

    webRequest.emit(startEvent);
    webRequest.emit({
      method_kind: 'onSendHeaders',
      tabId: TAB,
      requestId: 'wr-1',
      url: URL_A,
      method: 'GET',
      type: 'xmlhttprequest',
      timeStamp: STARTED_AT_MS + 1,
      requestHeaders: [{ name: 'Origin', value: APP_ORIGIN }],
    });
    webRequest.emit({
      method_kind: 'onHeadersReceived',
      tabId: TAB,
      requestId: 'wr-1',
      url: URL_A,
      method: 'GET',
      type: 'xmlhttprequest',
      timeStamp: STARTED_AT_MS + 2,
      statusCode: 200,
      responseHeaders: [{ name: 'Access-Control-Allow-Origin', value: 'https://other.openheaders.io' }],
    });
    webRequest.emit({
      method_kind: 'onErrorOccurred',
      tabId: TAB,
      requestId: 'wr-1',
      url: URL_A,
      method: 'GET',
      type: 'xmlhttprequest',
      timeStamp: STARTED_AT_MS + 50,
      error: 'net::ERR_FAILED',
    });

    const failed = collected.find((u) => u.kind === 'phase' && u.patch.phase === 'failed');
    if (failed?.kind !== 'phase') throw new Error('expected failed phase');
    expect(failed.patch.error?.code).toBe('oh:cors-origin-mismatch');
    correlator.dispose();
  });

  it('same-origin failure leaves net::ERR_FAILED untouched', () => {
    const { webRequest, har } = makeSources();
    const correlator = new HeuristicCorrelator({ webRequest, har });
    const collected: RequestLifecycleUpdate[] = [];
    correlator.subscribe((u) => collected.push(u));
    correlator.attachTab(TAB);

    webRequest.emit(startEvent);
    webRequest.emit({
      method_kind: 'onSendHeaders',
      tabId: TAB,
      requestId: 'wr-1',
      url: URL_A,
      method: 'GET',
      type: 'xmlhttprequest',
      timeStamp: STARTED_AT_MS + 1,
      requestHeaders: [{ name: 'Origin', value: 'https://api.openheaders.io' }],
    });
    webRequest.emit({
      method_kind: 'onHeadersReceived',
      tabId: TAB,
      requestId: 'wr-1',
      url: URL_A,
      method: 'GET',
      type: 'xmlhttprequest',
      timeStamp: STARTED_AT_MS + 2,
      statusCode: 200,
      responseHeaders: [],
    });
    webRequest.emit({
      method_kind: 'onErrorOccurred',
      tabId: TAB,
      requestId: 'wr-1',
      url: URL_A,
      method: 'GET',
      type: 'xmlhttprequest',
      timeStamp: STARTED_AT_MS + 50,
      error: 'net::ERR_FAILED',
    });

    const failed = collected.find((u) => u.kind === 'phase' && u.patch.phase === 'failed');
    if (failed?.kind !== 'phase') throw new Error('expected failed phase');
    expect(failed.patch.error?.code).toBe('net::ERR_FAILED');
    correlator.dispose();
  });

  it('non-net::ERR_FAILED errors are not refined even with a CORS verdict', () => {
    const { webRequest, har } = makeSources();
    const correlator = new HeuristicCorrelator({ webRequest, har });
    const collected: RequestLifecycleUpdate[] = [];
    correlator.subscribe((u) => collected.push(u));
    correlator.attachTab(TAB);

    webRequest.emit(startEvent);
    webRequest.emit({
      method_kind: 'onSendHeaders',
      tabId: TAB,
      requestId: 'wr-1',
      url: URL_A,
      method: 'GET',
      type: 'xmlhttprequest',
      timeStamp: STARTED_AT_MS + 1,
      requestHeaders: [{ name: 'Origin', value: 'https://app.openheaders.io' }],
    });
    webRequest.emit({
      method_kind: 'onHeadersReceived',
      tabId: TAB,
      requestId: 'wr-1',
      url: URL_A,
      method: 'GET',
      type: 'xmlhttprequest',
      timeStamp: STARTED_AT_MS + 2,
      statusCode: 0,
      responseHeaders: [],
    });
    webRequest.emit({
      method_kind: 'onErrorOccurred',
      tabId: TAB,
      requestId: 'wr-1',
      url: URL_A,
      method: 'GET',
      type: 'xmlhttprequest',
      timeStamp: STARTED_AT_MS + 50,
      error: 'net::ERR_CONNECTION_REFUSED',
    });

    const failed = collected.find((u) => u.kind === 'phase' && u.patch.phase === 'failed');
    if (failed?.kind !== 'phase') throw new Error('expected failed phase');
    expect(failed.patch.error?.code).toBe('net::ERR_CONNECTION_REFUSED');
    correlator.dispose();
  });
});

describe('HeuristicCorrelator — H5 detach scope', () => {
  it('detachTab clears the captured Origin (subsequent ERR_FAILED is not CORS-refined)', () => {
    const { webRequest, har } = makeSources();
    const correlator = new HeuristicCorrelator({ webRequest, har });
    const collected: RequestLifecycleUpdate[] = [];
    correlator.subscribe((u) => collected.push(u));
    correlator.attachTab(TAB);

    // Capture a cross-origin Origin, then detach (clears the CORS context).
    webRequest.emit(startEvent);
    webRequest.emit({
      method_kind: 'onSendHeaders',
      tabId: TAB,
      requestId: 'wr-1',
      url: URL_A,
      method: 'GET',
      type: 'xmlhttprequest',
      timeStamp: STARTED_AT_MS + 1,
      requestHeaders: [{ name: 'Origin', value: 'https://app.openheaders.io' }],
    });
    correlator.detachTab(TAB);
    correlator.attachTab(TAB);

    // New lifecycle on the re-attached tab; finish with ERR_FAILED. With
    // the prior Origin forgotten, the verdict carries no rejection, so
    // error.code must NOT be refined to `oh:cors-*`.
    const startEvent2 = {
      method_kind: 'onBeforeRequest' as const,
      tabId: TAB,
      requestId: 'wr-2',
      url: URL_A,
      method: 'GET',
      type: 'xmlhttprequest',
      timeStamp: STARTED_AT_MS + 100,
    };
    webRequest.emit(startEvent2);
    webRequest.emit({
      method_kind: 'onHeadersReceived',
      tabId: TAB,
      requestId: 'wr-2',
      url: URL_A,
      method: 'GET',
      type: 'xmlhttprequest',
      timeStamp: STARTED_AT_MS + 102,
      statusCode: 0,
      responseHeaders: [],
    });
    webRequest.emit({
      method_kind: 'onErrorOccurred',
      tabId: TAB,
      requestId: 'wr-2',
      url: URL_A,
      method: 'GET',
      type: 'xmlhttprequest',
      timeStamp: STARTED_AT_MS + 150,
      error: 'net::ERR_FAILED',
    });

    const failed = collected.find((u) => u.kind === 'phase' && u.patch.phase === 'failed' && u.requestId === 'wr-2');
    if (failed?.kind !== 'phase') throw new Error('expected failed phase for wr-2');
    expect(failed.patch.error?.code).toBe('net::ERR_FAILED');
    correlator.dispose();
  });
});

describe('HeuristicCorrelator — H8/H9 per-hop HAR + body attribution', () => {
  const URL_HOP0 = 'https://api.openheaders.io/start';
  const URL_HOP1 = 'https://api.openheaders.io/middle';
  const URL_HOP2 = 'https://api.openheaders.io/end';

  /**
   * Drive a full 3-hop chain (HOP0 → HOP1 → HOP2). Each hop emits the
   * webRequest events Chrome fires, in order: every hop begins at its own
   * onBeforeRequest (Chrome re-fires it for each redirect target under the
   * same requestId), then onSendHeaders, with onBeforeRedirect closing the
   * non-terminal hops.
   */
  function emit3HopChain(
    webRequest: TestWebRequestSource,
    opts: {
      methods: readonly [string, string, string];
      startMs: number;
    },
  ): void {
    const [m0, m1, m2] = opts.methods;
    // Hop 0
    webRequest.emit({
      method_kind: 'onBeforeRequest',
      tabId: TAB,
      requestId: 'wr-1',
      url: URL_HOP0,
      method: m0,
      type: 'xmlhttprequest',
      timeStamp: opts.startMs,
    });
    webRequest.emit({
      method_kind: 'onBeforeRedirect',
      tabId: TAB,
      requestId: 'wr-1',
      url: URL_HOP0,
      method: m0,
      type: 'xmlhttprequest',
      timeStamp: opts.startMs + 5,
      statusCode: 302,
      redirectUrl: URL_HOP1,
    });
    // Hop 1 — Chrome re-fires onBeforeRequest for the redirect target.
    webRequest.emit({
      method_kind: 'onBeforeRequest',
      tabId: TAB,
      requestId: 'wr-1',
      url: URL_HOP1,
      method: m1,
      type: 'xmlhttprequest',
      timeStamp: opts.startMs + 8,
    });
    webRequest.emit({
      method_kind: 'onSendHeaders',
      tabId: TAB,
      requestId: 'wr-1',
      url: URL_HOP1,
      method: m1,
      type: 'xmlhttprequest',
      timeStamp: opts.startMs + 10,
    });
    webRequest.emit({
      method_kind: 'onBeforeRedirect',
      tabId: TAB,
      requestId: 'wr-1',
      url: URL_HOP1,
      method: m1,
      type: 'xmlhttprequest',
      timeStamp: opts.startMs + 15,
      statusCode: 302,
      redirectUrl: URL_HOP2,
    });
    // Hop 2 — terminal hop, its own onBeforeRequest, no further redirect.
    webRequest.emit({
      method_kind: 'onBeforeRequest',
      tabId: TAB,
      requestId: 'wr-1',
      url: URL_HOP2,
      method: m2,
      type: 'xmlhttprequest',
      timeStamp: opts.startMs + 18,
    });
    webRequest.emit({
      method_kind: 'onSendHeaders',
      tabId: TAB,
      requestId: 'wr-1',
      url: URL_HOP2,
      method: m2,
      type: 'xmlhttprequest',
      timeStamp: opts.startMs + 20,
    });
  }

  it('mints a har-attached + body-attached per hop with monotonically increasing hopIndex', () => {
    const { webRequest, har } = makeSources();
    const correlator = new HeuristicCorrelator({ webRequest, har });
    const collected: RequestLifecycleUpdate[] = [];
    correlator.subscribe((u) => collected.push(u));
    correlator.attachTab(TAB);

    emit3HopChain(webRequest, { methods: ['GET', 'GET', 'GET'], startMs: STARTED_AT_MS });

    // HAR entries arrive in order with their respective URLs.
    har.emit({
      kind: 'har-entry',
      tabId: TAB,
      entry: harEntry({
        startedDateTime: new Date(STARTED_AT_MS).toISOString(),
        request: { method: 'GET', url: URL_HOP0, headers: [], queryString: [] },
      }),
    });
    har.emit({
      kind: 'har-entry',
      tabId: TAB,
      entry: harEntry({
        startedDateTime: new Date(STARTED_AT_MS + 10).toISOString(),
        request: { method: 'GET', url: URL_HOP1, headers: [], queryString: [] },
      }),
    });
    har.emit({
      kind: 'har-entry',
      tabId: TAB,
      entry: harEntry({
        startedDateTime: new Date(STARTED_AT_MS + 20).toISOString(),
        request: { method: 'GET', url: URL_HOP2, headers: [], queryString: [] },
      }),
    });

    const attached = collected.filter((u) => u.kind === 'har-attached');
    expect(attached).toHaveLength(3);
    expect(attached.map((u) => (u.kind === 'har-attached' ? u.hopIndex : -1))).toEqual([0, 1, 2]);

    // Bodies arrive — each by its own (method, url, startedDateTime).
    har.emit({
      kind: 'har-body',
      tabId: TAB,
      body: harBody({
        method: 'GET',
        url: URL_HOP0,
        startedDateTime: new Date(STARTED_AT_MS).toISOString(),
      }),
    });
    har.emit({
      kind: 'har-body',
      tabId: TAB,
      body: harBody({
        method: 'GET',
        url: URL_HOP1,
        startedDateTime: new Date(STARTED_AT_MS + 10).toISOString(),
      }),
    });
    har.emit({
      kind: 'har-body',
      tabId: TAB,
      body: harBody({
        method: 'GET',
        url: URL_HOP2,
        startedDateTime: new Date(STARTED_AT_MS + 20).toISOString(),
      }),
    });

    const bodies = collected.filter((u) => u.kind === 'body-attached');
    expect(bodies).toHaveLength(3);
    expect(bodies.map((u) => (u.kind === 'body-attached' ? u.hopIndex : -1))).toEqual([0, 1, 2]);
    correlator.dispose();
  });

  it('303 method rewrite (POST → GET) — the new hop FIFO entry uses the rewritten method', () => {
    const { webRequest, har } = makeSources();
    const correlator = new HeuristicCorrelator({ webRequest, har });
    const collected: RequestLifecycleUpdate[] = [];
    correlator.subscribe((u) => collected.push(u));
    correlator.attachTab(TAB);

    // Hop 0 is POST.
    webRequest.emit({
      method_kind: 'onBeforeRequest',
      tabId: TAB,
      requestId: 'wr-1',
      url: URL_HOP0,
      method: 'POST',
      type: 'xmlhttprequest',
      timeStamp: STARTED_AT_MS,
    });
    // 303 redirect.
    webRequest.emit({
      method_kind: 'onBeforeRedirect',
      tabId: TAB,
      requestId: 'wr-1',
      url: URL_HOP0,
      method: 'POST',
      type: 'xmlhttprequest',
      timeStamp: STARTED_AT_MS + 5,
      statusCode: 303,
      redirectUrl: URL_HOP1,
    });
    // Hop 1 — the redirect target's own onBeforeRequest carries the
    // rewritten GET method; the new hop's FIFO entry records here.
    webRequest.emit({
      method_kind: 'onBeforeRequest',
      tabId: TAB,
      requestId: 'wr-1',
      url: URL_HOP1,
      method: 'GET',
      type: 'xmlhttprequest',
      timeStamp: STARTED_AT_MS + 8,
    });
    webRequest.emit({
      method_kind: 'onSendHeaders',
      tabId: TAB,
      requestId: 'wr-1',
      url: URL_HOP1,
      method: 'GET',
      type: 'xmlhttprequest',
      timeStamp: STARTED_AT_MS + 10,
    });

    // HAR for hop 1 — request.method matches the rewritten GET.
    har.emit({
      kind: 'har-entry',
      tabId: TAB,
      entry: harEntry({
        startedDateTime: new Date(STARTED_AT_MS + 10).toISOString(),
        request: { method: 'GET', url: URL_HOP1, headers: [], queryString: [] },
      }),
    });

    const attached = collected.filter((u) => u.kind === 'har-attached');
    expect(attached).toHaveLength(1);
    if (attached[0]?.kind !== 'har-attached') throw new Error('expected har-attached');
    expect(attached[0].hopIndex).toBe(1);
    correlator.dispose();
  });

  it('forward race — a HAR arriving before its onBeforeRequest is held and drained on record', () => {
    const { webRequest, har } = makeSources();
    const correlator = new HeuristicCorrelator({ webRequest, har });
    const collected: RequestLifecycleUpdate[] = [];
    correlator.subscribe((u) => collected.push(u));
    correlator.attachTab(TAB);

    // The HAR lands before this request's onBeforeRequest has been processed
    // (an intra-process reordering); no FIFO entry yet, so the entry buffers.
    har.emit({
      kind: 'har-entry',
      tabId: TAB,
      entry: harEntry({
        startedDateTime: new Date(STARTED_AT_MS).toISOString(),
        request: { method: 'GET', url: URL_HOP0, headers: [], queryString: [] },
      }),
    });
    expect(collected.filter((u) => u.kind === 'har-attached')).toHaveLength(0);

    // onBeforeRequest finally lands — record runs, drain attaches at hop 0.
    webRequest.emit({
      method_kind: 'onBeforeRequest',
      tabId: TAB,
      requestId: 'wr-1',
      url: URL_HOP0,
      method: 'GET',
      type: 'xmlhttprequest',
      timeStamp: STARTED_AT_MS,
    });

    const attached = collected.filter((u) => u.kind === 'har-attached');
    expect(attached).toHaveLength(1);
    if (attached[0]?.kind !== 'har-attached') throw new Error('expected har-attached');
    expect(attached[0].hopIndex).toBe(0);
    correlator.dispose();
  });

  it('two redirects sharing a target URL — closest-timestamp picks the right hop', () => {
    const { webRequest, har } = makeSources();
    const correlator = new HeuristicCorrelator({ webRequest, har });
    const collected: RequestLifecycleUpdate[] = [];
    correlator.subscribe((u) => collected.push(u));
    correlator.attachTab(TAB);

    // A → B → A — hop 0 and hop 2 share URL_HOP0.
    webRequest.emit({
      method_kind: 'onBeforeRequest',
      tabId: TAB,
      requestId: 'wr-1',
      url: URL_HOP0,
      method: 'GET',
      type: 'xmlhttprequest',
      timeStamp: STARTED_AT_MS,
    });
    webRequest.emit({
      method_kind: 'onBeforeRedirect',
      tabId: TAB,
      requestId: 'wr-1',
      url: URL_HOP0,
      method: 'GET',
      type: 'xmlhttprequest',
      timeStamp: STARTED_AT_MS + 5,
      statusCode: 302,
      redirectUrl: URL_HOP1,
    });
    // Hop 1 — redirect target's own onBeforeRequest, then it redirects too.
    webRequest.emit({
      method_kind: 'onBeforeRequest',
      tabId: TAB,
      requestId: 'wr-1',
      url: URL_HOP1,
      method: 'GET',
      type: 'xmlhttprequest',
      timeStamp: STARTED_AT_MS + 8,
    });
    webRequest.emit({
      method_kind: 'onSendHeaders',
      tabId: TAB,
      requestId: 'wr-1',
      url: URL_HOP1,
      method: 'GET',
      type: 'xmlhttprequest',
      timeStamp: STARTED_AT_MS + 10,
    });
    webRequest.emit({
      method_kind: 'onBeforeRedirect',
      tabId: TAB,
      requestId: 'wr-1',
      url: URL_HOP1,
      method: 'GET',
      type: 'xmlhttprequest',
      timeStamp: STARTED_AT_MS + 15,
      statusCode: 302,
      redirectUrl: URL_HOP0,
    });
    // Hop 2 — back to URL_HOP0; its own onBeforeRequest.
    webRequest.emit({
      method_kind: 'onBeforeRequest',
      tabId: TAB,
      requestId: 'wr-1',
      url: URL_HOP0,
      method: 'GET',
      type: 'xmlhttprequest',
      timeStamp: STARTED_AT_MS + 18,
    });
    webRequest.emit({
      method_kind: 'onSendHeaders',
      tabId: TAB,
      requestId: 'wr-1',
      url: URL_HOP0,
      method: 'GET',
      type: 'xmlhttprequest',
      timeStamp: STARTED_AT_MS + 20,
    });

    // HAR for hop 2 (URL_HOP0 at t=+20) arrives first — closest-t wins.
    har.emit({
      kind: 'har-entry',
      tabId: TAB,
      entry: harEntry({
        startedDateTime: new Date(STARTED_AT_MS + 20).toISOString(),
        request: { method: 'GET', url: URL_HOP0, headers: [], queryString: [] },
      }),
    });
    har.emit({
      kind: 'har-entry',
      tabId: TAB,
      entry: harEntry({
        startedDateTime: new Date(STARTED_AT_MS).toISOString(),
        request: { method: 'GET', url: URL_HOP0, headers: [], queryString: [] },
      }),
    });

    const attached = collected.filter((u) => u.kind === 'har-attached');
    expect(attached).toHaveLength(2);
    const hopIndexes = attached.map((u) => (u.kind === 'har-attached' ? u.hopIndex : -1));
    // First match was hop 2 (t=+20 closest); second was hop 0.
    expect(hopIndexes).toEqual([2, 0]);
    correlator.dispose();
  });

  it('terminal phase releases the hop cursor (no leak across requestId reuse)', () => {
    const { webRequest, har } = makeSources();
    const correlator = new HeuristicCorrelator({ webRequest, har });
    const collected: RequestLifecycleUpdate[] = [];
    correlator.subscribe((u) => collected.push(u));
    correlator.attachTab(TAB);

    // Hop 0 + redirect + hop 1 + terminal.
    emit3HopChain(webRequest, { methods: ['GET', 'GET', 'GET'], startMs: STARTED_AT_MS });
    webRequest.emit({
      method_kind: 'onCompleted',
      tabId: TAB,
      requestId: 'wr-1',
      url: URL_HOP2,
      method: 'GET',
      type: 'xmlhttprequest',
      timeStamp: STARTED_AT_MS + 50,
      statusCode: 200,
    });

    // A subsequent onBeforeRedirect for the same requestId would be a
    // host-side bug, but the cursor must be gone — `noteRedirect` on
    // an unknown lifecycle is a no-op (covered by the HopCursor unit
    // test). Smoke test here: no leftover state surfaces a hop-2 FIFO
    // entry for a later HAR with URL_HOP2.
    har.emit({
      kind: 'har-entry',
      tabId: TAB,
      entry: harEntry({
        startedDateTime: new Date(STARTED_AT_MS + 20).toISOString(),
        request: { method: 'GET', url: URL_HOP2, headers: [], queryString: [] },
      }),
    });
    const attached = collected.filter((u) => u.kind === 'har-attached');
    // Each of the three hops should still attach exactly once.
    expect(attached.map((u) => (u.kind === 'har-attached' ? u.hopIndex : -1))).toEqual([2]);
    correlator.dispose();
  });
});

describe('HeuristicCorrelator — DNR in-place URL rewrite', () => {
  // A declarativeNetRequest `redirect`/`query-param` rule rewrites the URL IN
  // PLACE: webRequest fires NO onBeforeRedirect for it — onSendHeaders simply
  // carries a different URL than the hop's onBeforeRequest. The correlator
  // synthesizes the internal-redirect hop from that change so the chain matches
  // the host's devtools view (a separate 307 leg + the rewritten destination).
  const U0 = 'http://localhost:3000/net/status/301';
  const U1 = 'http://localhost:3000/echo/redirected';
  const U2 = 'http://localhost:3000/echo/redirected?added=yes&overridden=server';

  function legHar(url: string, status: number, statusText: string, atMs: number): InspectorHarEntry {
    return harEntry({
      startedDateTime: new Date(atMs).toISOString(),
      request: { method: 'GET', url, headers: [], queryString: [] },
      response: { status, statusText, headers: [], content: { size: 0, mimeType: 'text/plain' } },
    });
  }

  function foldLifecycle(updates: readonly RequestLifecycleUpdate[], requestId: string): RequestLifecycle | undefined {
    let lc: RequestLifecycle | undefined;
    for (const u of updates) {
      const rid = u.kind === 'started' ? u.lifecycle.requestId : u.requestId;
      if (rid !== requestId) continue;
      const res = reduce(lc, u);
      if (res.kind === 'insert' || res.kind === 'update') lc = res.next;
      else if (res.kind === 'delete') lc = undefined;
    }
    return lc;
  }

  it('a rewrite after a server 301 splits into 301 → 307 → 200 hops', () => {
    const { webRequest, har } = makeSources();
    const correlator = new HeuristicCorrelator({ webRequest, har });
    const collected: RequestLifecycleUpdate[] = [];
    correlator.subscribe((u) => collected.push(u));
    correlator.attachTab(TAB);

    const t = STARTED_AT_MS;
    // Hop 0 — real server 301 (onHeadersReceived(3xx) + onBeforeRedirect).
    webRequest.emit({
      method_kind: 'onBeforeRequest',
      tabId: TAB,
      requestId: 'wr-1',
      url: U0,
      method: 'GET',
      type: 'xmlhttprequest',
      timeStamp: t,
    });
    webRequest.emit({
      method_kind: 'onSendHeaders',
      tabId: TAB,
      requestId: 'wr-1',
      url: U0,
      method: 'GET',
      type: 'xmlhttprequest',
      timeStamp: t + 1,
      requestHeaders: [],
    });
    webRequest.emit({
      method_kind: 'onHeadersReceived',
      tabId: TAB,
      requestId: 'wr-1',
      url: U0,
      method: 'GET',
      type: 'xmlhttprequest',
      timeStamp: t + 2,
      statusCode: 301,
      statusLine: 'HTTP/1.1 301 Moved Permanently',
      responseHeaders: [],
    });
    webRequest.emit({
      method_kind: 'onBeforeRedirect',
      tabId: TAB,
      requestId: 'wr-1',
      url: U0,
      method: 'GET',
      type: 'xmlhttprequest',
      timeStamp: t + 3,
      statusCode: 301,
      redirectUrl: U1,
    });
    // Hop 1 — the 301 target. The query-param rule rewrites it IN PLACE: no
    // onBeforeRedirect; onSendHeaders carries the rewritten URL (U2) not U1.
    webRequest.emit({
      method_kind: 'onBeforeRequest',
      tabId: TAB,
      requestId: 'wr-1',
      url: U1,
      method: 'GET',
      type: 'xmlhttprequest',
      timeStamp: t + 4,
    });
    webRequest.emit({
      method_kind: 'onSendHeaders',
      tabId: TAB,
      requestId: 'wr-1',
      url: U2,
      method: 'GET',
      type: 'xmlhttprequest',
      timeStamp: t + 5,
      requestHeaders: [],
    });
    webRequest.emit({
      method_kind: 'onHeadersReceived',
      tabId: TAB,
      requestId: 'wr-1',
      url: U2,
      method: 'GET',
      type: 'xmlhttprequest',
      timeStamp: t + 6,
      statusCode: 200,
      statusLine: 'HTTP/1.1 200 OK',
      responseHeaders: [],
    });
    webRequest.emit({
      method_kind: 'onCompleted',
      tabId: TAB,
      requestId: 'wr-1',
      url: U2,
      method: 'GET',
      type: 'xmlhttprequest',
      timeStamp: t + 7,
      statusCode: 200,
      statusLine: 'HTTP/1.1 200 OK',
    });

    // Devtools records all three legs (it sees the internal 307).
    har.emit({ kind: 'har-entry', tabId: TAB, entry: legHar(U0, 301, 'Moved Permanently', t) });
    har.emit({ kind: 'har-entry', tabId: TAB, entry: legHar(U1, 307, 'Internal Redirect', t + 4) });
    har.emit({ kind: 'har-entry', tabId: TAB, entry: legHar(U2, 200, 'OK', t + 6) });

    const lc = foldLifecycle(collected, 'wr-1');
    if (!lc) throw new Error('expected a lifecycle');

    // The in-place rewrite became its own 307 hop; the chain is 301 → 307 → 200.
    expect(lc.redirectHopCount).toBe(2);
    expect(lc.redirectHops.map((h) => h.statusCode)).toEqual([301, 307]);
    expect(lc.redirectHops[1]?.sourceUrl).toBe(U1);
    expect(lc.redirectHops[1]?.redirectUrl).toBe(U2);
    // The server 301 is not a rule rewrite; only the in-place 307 is internal.
    expect(lc.redirectHops[0]?.internal).toBeFalsy();
    expect(lc.redirectHops[1]?.internal).toBe(true);
    expect(lc.har[0]?.response?.status).toBe(301);
    expect(lc.har[1]?.response?.status).toBe(307);
    expect(lc.har[2]?.response?.status).toBe(200);
    expect(lc.phase).toBe('completed');
    expect(lc.statusCode).toBe(200);
    correlator.dispose();
  });

  it('a rewrite on the initial request splits into 307 → 200 hops', () => {
    const { webRequest, har } = makeSources();
    const correlator = new HeuristicCorrelator({ webRequest, har });
    const collected: RequestLifecycleUpdate[] = [];
    correlator.subscribe((u) => collected.push(u));
    correlator.attachTab(TAB);

    const t = STARTED_AT_MS;
    const Ua = 'http://localhost:3000/echo?test=qp-add&run=x';
    const Ub = 'http://localhost:3000/echo?test=qp-add&run=x&added=yes';
    // The query-param rule rewrites the initial request in place — onBeforeRequest
    // carries Ua, onSendHeaders the rewritten Ub, with no onBeforeRedirect.
    webRequest.emit({
      method_kind: 'onBeforeRequest',
      tabId: TAB,
      requestId: 'wr-1',
      url: Ua,
      method: 'GET',
      type: 'xmlhttprequest',
      timeStamp: t,
    });
    webRequest.emit({
      method_kind: 'onSendHeaders',
      tabId: TAB,
      requestId: 'wr-1',
      url: Ub,
      method: 'GET',
      type: 'xmlhttprequest',
      timeStamp: t + 1,
      requestHeaders: [],
    });
    webRequest.emit({
      method_kind: 'onHeadersReceived',
      tabId: TAB,
      requestId: 'wr-1',
      url: Ub,
      method: 'GET',
      type: 'xmlhttprequest',
      timeStamp: t + 2,
      statusCode: 200,
      statusLine: 'HTTP/1.1 200 OK',
      responseHeaders: [],
    });
    webRequest.emit({
      method_kind: 'onCompleted',
      tabId: TAB,
      requestId: 'wr-1',
      url: Ub,
      method: 'GET',
      type: 'xmlhttprequest',
      timeStamp: t + 3,
      statusCode: 200,
      statusLine: 'HTTP/1.1 200 OK',
    });

    har.emit({ kind: 'har-entry', tabId: TAB, entry: legHar(Ua, 307, 'Internal Redirect', t) });
    har.emit({ kind: 'har-entry', tabId: TAB, entry: legHar(Ub, 200, 'OK', t + 1) });

    const lc = foldLifecycle(collected, 'wr-1');
    if (!lc) throw new Error('expected a lifecycle');

    expect(lc.redirectHopCount).toBe(1);
    expect(lc.redirectHops.map((h) => h.statusCode)).toEqual([307]);
    expect(lc.redirectHops[0]?.sourceUrl).toBe(Ua);
    expect(lc.redirectHops[0]?.internal).toBe(true);
    expect(lc.har[0]?.response?.status).toBe(307);
    expect(lc.har[1]?.response?.status).toBe(200);
    expect(lc.phase).toBe('completed');
    expect(lc.statusCode).toBe(200);
    correlator.dispose();
  });
});

describe('HeuristicCorrelator — exposes no chrome surface', () => {
  it('module export does not name fromChromeWebRequest (kept out of oracle)', () => {
    const ctor = HeuristicCorrelator as unknown as Record<string, unknown>;
    expect(ctor.fromChromeWebRequest).toBeUndefined();
  });
});

describe('HeuristicCorrelator — override join (page-relayed served/original)', () => {
  const servedOverride = (): OverrideEvent => ({
    tabId: TAB,
    url: URL_A,
    method: 'GET',
    startedAtMs: STARTED_AT_MS,
    response: {
      ruleUid: 'r1',
      served: { statusCode: 200, body: { content: '{"served":true}', encoding: '' } },
      original: { statusCode: 200, body: { content: '{"server":true}', encoding: '' } },
    },
  });

  it('attaches a response override to a started lifecycle (backward join by url/method)', () => {
    const { webRequest, har } = makeSources();
    const override = new TestOverrideSource();
    const correlator = new HeuristicCorrelator({ webRequest, har, override });
    const collected: RequestLifecycleUpdate[] = [];
    correlator.subscribe((u) => collected.push(u));
    correlator.attachTab(TAB);

    webRequest.emit(startEvent); // lifecycle started (requestId wr-1, URL_A)
    override.emit(servedOverride()); // relayed after the response

    const attached = collected.find((u) => u.kind === 'response-override-attached');
    expect(attached).toBeDefined();
    if (attached?.kind !== 'response-override-attached') throw new Error('expected response-override-attached');
    expect(attached.requestId).toBe('wr-1');
    expect(attached.override.served.body?.content).toBe('{"served":true}');
    expect(attached.override.original?.body?.content).toBe('{"server":true}');
    correlator.dispose();
  });

  it('buffers an override that arrives before its lifecycle and drains on started (forward race)', () => {
    const { webRequest, har } = makeSources();
    const override = new TestOverrideSource();
    const correlator = new HeuristicCorrelator({ webRequest, har, override });
    const collected: RequestLifecycleUpdate[] = [];
    correlator.subscribe((u) => collected.push(u));
    correlator.attachTab(TAB);

    override.emit(servedOverride()); // relayed BEFORE the request went out
    expect(collected.some((u) => u.kind === 'response-override-attached')).toBe(false);

    webRequest.emit(startEvent); // started → drains the buffered override
    const attached = collected.find((u) => u.kind === 'response-override-attached');
    if (attached?.kind !== 'response-override-attached') throw new Error('expected response-override-attached');
    expect(attached.requestId).toBe('wr-1');
    correlator.dispose();
  });

  it('drops an override that matches no lifecycle (different url)', () => {
    const { webRequest, har } = makeSources();
    const override = new TestOverrideSource();
    const correlator = new HeuristicCorrelator({ webRequest, har, override });
    const collected: RequestLifecycleUpdate[] = [];
    correlator.subscribe((u) => collected.push(u));
    correlator.attachTab(TAB);

    webRequest.emit(startEvent); // URL_A
    override.emit({ ...servedOverride(), url: URL_B }); // no matching lifecycle
    expect(collected.some((u) => u.kind === 'response-override-attached')).toBe(false);
    correlator.dispose();
  });

  it('joins an override to the chain-root url after a redirect rewrote the request', () => {
    const { webRequest, har } = makeSources();
    const override = new TestOverrideSource();
    const correlator = new HeuristicCorrelator({ webRequest, har, override });
    const collected: RequestLifecycleUpdate[] = [];
    correlator.subscribe((u) => collected.push(u));
    correlator.attachTab(TAB);

    // hop 0: the original url the page fetched (started → mirror keyed on URL_A).
    webRequest.emit(startEvent);
    // a query-param/redirect rule rewrites URL_A → URL_B.
    webRequest.emit({
      method_kind: 'onBeforeRedirect',
      tabId: TAB,
      requestId: 'wr-1',
      url: URL_A,
      method: 'GET',
      type: 'xmlhttprequest',
      timeStamp: STARTED_AT_MS + 1,
      statusCode: 307,
      redirectUrl: URL_B,
    });
    // the redirect target re-fires onBeforeRequest with the REWRITTEN url — the
    // per-event mapper maps it to a second `started`(URL_B) the store rejects;
    // the mirror must keep the first (URL_A), not overwrite to URL_B.
    webRequest.emit({
      method_kind: 'onBeforeRequest',
      tabId: TAB,
      requestId: 'wr-1',
      url: URL_B,
      method: 'GET',
      type: 'xmlhttprequest',
      timeStamp: STARTED_AT_MS + 2,
    });

    // the page relays the override with the ORIGINAL url it fetched (URL_A).
    override.emit({
      tabId: TAB,
      url: URL_A,
      method: 'GET',
      startedAtMs: STARTED_AT_MS,
      response: { ruleUid: 'r1', served: { body: { content: 'served', encoding: '' } } },
    });

    const attached = collected.find((u) => u.kind === 'response-override-attached');
    if (attached?.kind !== 'response-override-attached') throw new Error('expected response-override-attached');
    expect(attached.requestId).toBe('wr-1');
    correlator.dispose();
  });

  it('attaches a request override (request-body) by url/method', () => {
    const { webRequest, har } = makeSources();
    const override = new TestOverrideSource();
    const correlator = new HeuristicCorrelator({ webRequest, har, override });
    const collected: RequestLifecycleUpdate[] = [];
    correlator.subscribe((u) => collected.push(u));
    correlator.attachTab(TAB);

    webRequest.emit(startEvent);
    override.emit({
      tabId: TAB,
      url: URL_A,
      method: 'GET',
      startedAtMs: STARTED_AT_MS,
      request: {
        ruleUid: 'r1',
        sent: { body: { content: 'sent', encoding: '' } },
        original: { body: { content: 'page', encoding: '' } },
      },
    });

    const attached = collected.find((u) => u.kind === 'request-override-attached');
    if (attached?.kind !== 'request-override-attached') throw new Error('expected request-override-attached');
    expect(attached.requestId).toBe('wr-1');
    expect(attached.override.original?.body?.content).toBe('page');
    correlator.dispose();
  });
});
