/**
 * `HeuristicCorrelator` driven by in-memory event sources.
 *
 * Mirrors the CDP stub's tests one-for-one (attach gate, subscribe,
 * detach, dispose) — the symmetry proves the {@link RequestCorrelator}
 * contract is satisfied by both strategies. Extended in H2/H3 with
 * HAR-flow scenarios covering the closest-timestamp join, body
 * attachment, and per-tab forget.
 */

import { describe, expect, it, vi } from 'vitest';

import type {
  RequestLifecycleListener,
  RequestLifecycleUpdate,
} from '@openheaders/core/request-lifecycle';
import type { InspectorHarBody, InspectorHarEntry } from '@openheaders/core/types';

import { HeuristicCorrelator } from '../../src/correlator-heuristic/correlator';
import type { WebRequestEvent, WebRequestEventSource } from '../../src/correlator-heuristic/events';
import type { HarEvent, HarEventSource } from '../../src/correlator-heuristic/har-events';
import { LATE_ARRIVAL_WINDOW_MS } from '../../src/correlator-heuristic/late-arrival-constants';

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
      timeStamp: STARTED_AT_MS + LATE_ARRIVAL_WINDOW_MS + 100,
    });
    // Now the matching onBeforeRequest finally arrives — too late.
    webRequest.emit({
      ...startEvent,
      timeStamp: STARTED_AT_MS + LATE_ARRIVAL_WINDOW_MS + 200,
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
      timeStamp: STARTED_AT_MS + 50 + LATE_ARRIVAL_WINDOW_MS + 100,
    });
    // Late HAR — recentLifecycles for wr-1 is already pruned.
    har.emit({
      kind: 'har-entry',
      tabId: TAB,
      entry: harEntry({
        startedDateTime: new Date(STARTED_AT_MS + 50 + LATE_ARRIVAL_WINDOW_MS + 200).toISOString(),
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
      timeStamp: STARTED_AT_MS + LATE_ARRIVAL_WINDOW_MS,
    });
    webRequest.emit({
      method_kind: 'onCompleted',
      tabId: TAB,
      requestId: 'wr-2',
      url: URL_B,
      method: 'GET',
      type: 'xmlhttprequest',
      timeStamp: STARTED_AT_MS + LATE_ARRIVAL_WINDOW_MS + 50,
      statusCode: 200,
    });
    // Another event ticks gc past wr-1's window but not wr-2's.
    webRequest.emit({
      ...startEvent,
      requestId: 'wr-3',
      url: 'https://api.openheaders.io/z',
      timeStamp: STARTED_AT_MS + LATE_ARRIVAL_WINDOW_MS + 100,
    });
    // HAR for wr-2 — should still attach.
    har.emit({
      kind: 'har-entry',
      tabId: TAB,
      entry: harEntry({
        startedDateTime: new Date(STARTED_AT_MS + LATE_ARRIVAL_WINDOW_MS).toISOString(),
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

describe('HeuristicCorrelator — H5 CORS classification', () => {
  const APP_ORIGIN = 'https://app.openheaders.io';
  const API_ORIGIN = 'https://api.openheaders.io';

  function emitCorsFlow(
    webRequest: TestWebRequestSource,
    opts: {
      origin: string;
      acao?: string;
    },
  ): void {
    webRequest.emit(startEvent);
    webRequest.emit({
      method_kind: 'onSendHeaders',
      tabId: TAB,
      requestId: 'wr-1',
      url: URL_A,
      method: 'GET',
      type: 'xmlhttprequest',
      timeStamp: STARTED_AT_MS + 1,
      requestHeaders: [{ name: 'Origin', value: opts.origin }],
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
      responseHeaders:
        opts.acao !== undefined
          ? [{ name: 'Access-Control-Allow-Origin', value: opts.acao }]
          : [],
    });
  }

  it('attaches cors verdict to the headers-received patch (cross-origin missing ACAO)', () => {
    const { webRequest, har } = makeSources();
    const correlator = new HeuristicCorrelator({ webRequest, har });
    const collected: RequestLifecycleUpdate[] = [];
    correlator.subscribe((u) => collected.push(u));
    correlator.attachTab(TAB);

    emitCorsFlow(webRequest, { origin: APP_ORIGIN });

    const headers = collected.find(
      (u) => u.kind === 'phase' && u.patch.phase === 'headers-received',
    );
    if (headers?.kind !== 'phase') throw new Error('expected headers-received phase');
    expect(headers.patch.cors).toEqual({
      isCrossOrigin: true,
      rejection: { kind: 'missing-acao' },
    });
    correlator.dispose();
  });

  it('same-origin request emits no-rejection verdict', () => {
    const { webRequest, har } = makeSources();
    const correlator = new HeuristicCorrelator({ webRequest, har });
    const collected: RequestLifecycleUpdate[] = [];
    correlator.subscribe((u) => collected.push(u));
    correlator.attachTab(TAB);

    emitCorsFlow(webRequest, { origin: API_ORIGIN });

    const headers = collected.find(
      (u) => u.kind === 'phase' && u.patch.phase === 'headers-received',
    );
    if (headers?.kind !== 'phase') throw new Error('expected headers-received phase');
    expect(headers.patch.cors).toEqual({
      isCrossOrigin: false,
      rejection: { kind: 'no-rejection' },
    });
    correlator.dispose();
  });

  it('cross-origin + ACAO=* emits no-rejection (cross-origin allowed)', () => {
    const { webRequest, har } = makeSources();
    const correlator = new HeuristicCorrelator({ webRequest, har });
    const collected: RequestLifecycleUpdate[] = [];
    correlator.subscribe((u) => collected.push(u));
    correlator.attachTab(TAB);

    emitCorsFlow(webRequest, { origin: APP_ORIGIN, acao: '*' });

    const headers = collected.find(
      (u) => u.kind === 'phase' && u.patch.phase === 'headers-received',
    );
    if (headers?.kind !== 'phase') throw new Error('expected headers-received phase');
    expect(headers.patch.cors).toEqual({
      isCrossOrigin: true,
      rejection: { kind: 'no-rejection' },
    });
    correlator.dispose();
  });
});

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
    expect(failed.patch.cors).toEqual({
      isCrossOrigin: true,
      rejection: { kind: 'missing-acao' },
    });
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
      responseHeaders: [
        { name: 'Access-Control-Allow-Origin', value: 'https://other.openheaders.io' },
      ],
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
    expect(failed.patch.cors?.rejection.kind).toBe('missing-acao');
    correlator.dispose();
  });
});

describe('HeuristicCorrelator — H5 detach + redirect scope', () => {
  it('detachTab clears pending CORS context (no verdict on re-attached lifecycle)', () => {
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

    correlator.detachTab(TAB);
    correlator.attachTab(TAB);

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

    // After detach + re-attach, prior origin is forgotten — the verdict
    // for headers-received reports same-origin (no Origin captured).
    const headers = collected.find(
      (u) => u.kind === 'phase' && u.patch.phase === 'headers-received',
    );
    if (headers?.kind !== 'phase') throw new Error('expected headers-received phase');
    expect(headers.patch.cors).toEqual({
      isCrossOrigin: false,
      rejection: { kind: 'no-rejection' },
    });
    correlator.dispose();
  });
});

describe('HeuristicCorrelator — H8/H9 per-hop HAR + body attribution', () => {
  const URL_HOP0 = 'https://api.openheaders.io/start';
  const URL_HOP1 = 'https://api.openheaders.io/middle';
  const URL_HOP2 = 'https://api.openheaders.io/end';

  /**
   * Drive a full 3-hop chain (HOP0 → HOP1 → HOP2). Each hop emits the
   * webRequest events Chrome would fire, in order: hop 0 starts via
   * onBeforeRequest; subsequent hops record via onSendHeaders following
   * onBeforeRedirect.
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
    // Hop 1
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
    // Hop 2 — terminal hop, no further redirect.
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
    // Hop 1 — outgoing method is GET.
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

  it('forward race — a HAR for hop 1 arriving before onSendHeaders is held and drained on record', () => {
    const { webRequest, har } = makeSources();
    const correlator = new HeuristicCorrelator({ webRequest, har });
    const collected: RequestLifecycleUpdate[] = [];
    correlator.subscribe((u) => collected.push(u));
    correlator.attachTab(TAB);

    // Hop 0 + redirect, but hop-1 onSendHeaders has not fired yet.
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

    // HAR for hop 1 lands early — no FIFO entry for URL_HOP1 yet,
    // entry is buffered.
    har.emit({
      kind: 'har-entry',
      tabId: TAB,
      entry: harEntry({
        startedDateTime: new Date(STARTED_AT_MS + 10).toISOString(),
        request: { method: 'GET', url: URL_HOP1, headers: [], queryString: [] },
      }),
    });
    expect(collected.filter((u) => u.kind === 'har-attached')).toHaveLength(0);

    // Now onSendHeaders for hop 1 — record runs, drain attaches.
    webRequest.emit({
      method_kind: 'onSendHeaders',
      tabId: TAB,
      requestId: 'wr-1',
      url: URL_HOP1,
      method: 'GET',
      type: 'xmlhttprequest',
      timeStamp: STARTED_AT_MS + 10,
    });

    const attached = collected.filter((u) => u.kind === 'har-attached');
    expect(attached).toHaveLength(1);
    if (attached[0]?.kind !== 'har-attached') throw new Error('expected har-attached');
    expect(attached[0].hopIndex).toBe(1);
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

describe('HeuristicCorrelator — exposes no chrome surface', () => {
  it('module export does not name fromChromeWebRequest (kept out of oracle)', () => {
    const ctor = HeuristicCorrelator as unknown as Record<string, unknown>;
    expect(ctor.fromChromeWebRequest).toBeUndefined();
  });
});
