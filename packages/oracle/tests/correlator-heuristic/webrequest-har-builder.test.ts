/**
 * `WebRequestHarBuilder` — stateful partial-HAR synthesis across the
 * webRequest hop lifecycle: partial at `onHeadersReceived`, refined at
 * the hop terminal, superseded per hop by a joined devtools HAR.
 */

import type { RequestLifecycleUpdate } from '@openheaders/core/request-lifecycle';
import type { ResourceTimingEntry } from '@openheaders/core/resource-timing';
import { describe, expect, it } from 'vitest';

import type { WebRequestEvent } from '../../src/correlator-heuristic/events';
import type { ResourceTimingSnapshotEvent } from '../../src/correlator-heuristic/resource-timing-events';
import { RT_RETENTION_MS, WebRequestHarBuilder } from '../../src/correlator-heuristic/webrequest-har-builder';

const TAB = 11;
const REQUEST_ID = 'wr-1';
const URL_A = 'https://api.openheaders.io/x';
const URL_B = 'https://api.openheaders.io/y';
const T0 = 1_700_000_000_000;

function start(overrides?: Partial<Extract<WebRequestEvent, { method_kind: 'onBeforeRequest' }>>): WebRequestEvent {
  return {
    method_kind: 'onBeforeRequest',
    tabId: TAB,
    requestId: REQUEST_ID,
    url: URL_A,
    method: 'GET',
    type: 'main_frame',
    timeStamp: T0,
    ...overrides,
  };
}

function sendHeaders(overrides?: Partial<Extract<WebRequestEvent, { method_kind: 'onSendHeaders' }>>): WebRequestEvent {
  return {
    method_kind: 'onSendHeaders',
    tabId: TAB,
    requestId: REQUEST_ID,
    url: URL_A,
    method: 'GET',
    type: 'main_frame',
    timeStamp: T0 + 10,
    requestHeaders: [{ name: 'Accept', value: 'text/html' }],
    ...overrides,
  };
}

function headersReceived(
  overrides?: Partial<Extract<WebRequestEvent, { method_kind: 'onHeadersReceived' }>>,
): WebRequestEvent {
  return {
    method_kind: 'onHeadersReceived',
    tabId: TAB,
    requestId: REQUEST_ID,
    url: URL_A,
    method: 'GET',
    type: 'main_frame',
    timeStamp: T0 + 400,
    statusCode: 200,
    statusLine: 'HTTP/1.1 200 OK',
    responseHeaders: [{ name: 'Content-Type', value: 'text/html' }],
    ...overrides,
  };
}

function errorOccurred(
  overrides?: Partial<Extract<WebRequestEvent, { method_kind: 'onErrorOccurred' }>>,
): WebRequestEvent {
  return {
    method_kind: 'onErrorOccurred',
    tabId: TAB,
    requestId: REQUEST_ID,
    url: URL_A,
    method: 'GET',
    type: 'main_frame',
    timeStamp: T0 + 2_000,
    error: 'net::ERR_ABORTED',
    ip: '140.82.121.4',
    ...overrides,
  };
}

function completed(overrides?: Partial<Extract<WebRequestEvent, { method_kind: 'onCompleted' }>>): WebRequestEvent {
  return {
    method_kind: 'onCompleted',
    tabId: TAB,
    requestId: REQUEST_ID,
    url: URL_A,
    method: 'GET',
    type: 'main_frame',
    timeStamp: T0 + 2_000,
    statusCode: 200,
    statusLine: 'HTTP/1.1 200 OK',
    ip: '140.82.121.4',
    ...overrides,
  };
}

function observeAll(builder: WebRequestHarBuilder, events: readonly WebRequestEvent[]): RequestLifecycleUpdate[] {
  const out: RequestLifecycleUpdate[] = [];
  for (const event of events) out.push(...builder.observe(event));
  return out;
}

function harAttached(updates: readonly RequestLifecycleUpdate[]) {
  return updates.filter((u) => u.kind === 'har-attached');
}

describe('WebRequestHarBuilder — partial at onHeadersReceived', () => {
  it('emits one partial har-attached at hop 0 carrying the wire facts', () => {
    const builder = new WebRequestHarBuilder();
    const updates = observeAll(builder, [start(), sendHeaders(), headersReceived()]);
    const attached = harAttached(updates);
    expect(attached).toHaveLength(1);
    const update = attached[0];
    if (update?.kind !== 'har-attached') throw new Error('expected har-attached');
    expect(update).toMatchObject({ tabId: TAB, requestId: REQUEST_ID, hopIndex: 0 });
    expect(update.har.response?.status).toBe(200);
    expect(update.har.response?.headers).toEqual([{ name: 'Content-Type', value: 'text/html' }]);
    expect(update.har.request?.headers).toEqual([{ name: 'Accept', value: 'text/html' }]);
    expect(update.har.time).toBeUndefined();
  });

  it('emits nothing before the response and nothing for an unseeded request', () => {
    const builder = new WebRequestHarBuilder();
    expect(observeAll(builder, [start(), sendHeaders()])).toHaveLength(0);
    expect(builder.observe(headersReceived({ requestId: 'unseen' }))).toHaveLength(0);
  });
});

describe('WebRequestHarBuilder — terminal refinement', () => {
  it('re-emits refined with ip, error, and total time at onErrorOccurred, retained for the RT window', () => {
    const builder = new WebRequestHarBuilder();
    const updates = observeAll(builder, [start(), sendHeaders(), headersReceived(), errorOccurred()]);
    const attached = harAttached(updates);
    expect(attached).toHaveLength(2);
    const refined = attached[1];
    if (refined?.kind !== 'har-attached') throw new Error('expected har-attached');
    expect(refined.har.serverIPAddress).toBe('140.82.121.4');
    expect(refined.har.response?._error).toBe('net::ERR_ABORTED');
    expect(refined.har.time).toBe(2_000);
    // Retained for a late Resource Timing join; gc ages it out.
    expect(builder.size()).toBe(1);
    builder.gc(T0 + 2_000 + RT_RETENTION_MS + 1);
    expect(builder.size()).toBe(0);
  });

  it('refines cleanly at onCompleted (no error, ip + time set)', () => {
    const builder = new WebRequestHarBuilder();
    const updates = observeAll(builder, [start(), sendHeaders(), headersReceived(), completed()]);
    const refined = harAttached(updates)[1];
    if (refined?.kind !== 'har-attached') throw new Error('expected har-attached');
    expect(refined.har.serverIPAddress).toBe('140.82.121.4');
    expect(refined.har.response?._error).toBeNull();
    expect(refined.har.time).toBe(2_000);
  });

  it('a terminal with no prior response emits nothing (failed before headers)', () => {
    const builder = new WebRequestHarBuilder();
    const updates = observeAll(builder, [start(), sendHeaders(), errorOccurred()]);
    expect(harAttached(updates)).toHaveLength(0);
    builder.gc(T0 + 2_000 + RT_RETENTION_MS + 1);
    expect(builder.size()).toBe(0);
  });
});

describe('WebRequestHarBuilder — joined-HAR supersession', () => {
  it('a real HAR for the hop suppresses the terminal refinement', () => {
    const builder = new WebRequestHarBuilder();
    const partial = observeAll(builder, [start(), sendHeaders(), headersReceived()]);
    expect(harAttached(partial)).toHaveLength(1);
    builder.noteRealHar(TAB, REQUEST_ID, 0);
    expect(harAttached(observeAll(builder, [completed()]))).toHaveLength(0);
  });

  it('a real HAR for an earlier hop leaves the next hop partial flow intact', () => {
    const builder = new WebRequestHarBuilder();
    observeAll(builder, [start(), sendHeaders(), headersReceived({ statusCode: 302 })]);
    builder.noteRealHar(TAB, REQUEST_ID, 0);
    const redirect: WebRequestEvent = {
      method_kind: 'onBeforeRedirect',
      tabId: TAB,
      requestId: REQUEST_ID,
      url: URL_A,
      method: 'GET',
      type: 'main_frame',
      timeStamp: T0 + 500,
      statusCode: 302,
      redirectUrl: URL_B,
    };
    // Hop 0 is superseded — the redirect's own refinement is suppressed…
    expect(harAttached(builder.observe(redirect))).toHaveLength(0);
    // …but hop 1 emits its partial normally.
    const hop1 = observeAll(builder, [
      sendHeaders({ url: URL_B, timeStamp: T0 + 510 }),
      headersReceived({ url: URL_B, timeStamp: T0 + 900 }),
    ]);
    const attached = harAttached(hop1);
    expect(attached).toHaveLength(1);
    expect(attached[0]).toMatchObject({ hopIndex: 1 });
    if (attached[0]?.kind === 'har-attached') {
      expect(attached[0].har.request?.url).toBe(URL_B);
    }
  });
});

describe('WebRequestHarBuilder — redirect hops', () => {
  it('refines the finishing hop at onBeforeRedirect and re-seeds the next', () => {
    const builder = new WebRequestHarBuilder();
    observeAll(builder, [
      start(),
      sendHeaders(),
      headersReceived({
        statusCode: 302,
        statusLine: 'HTTP/1.1 302 Found',
        responseHeaders: [{ name: 'Location', value: URL_B }],
      }),
    ]);
    const redirect: WebRequestEvent = {
      method_kind: 'onBeforeRedirect',
      tabId: TAB,
      requestId: REQUEST_ID,
      url: URL_A,
      method: 'GET',
      type: 'main_frame',
      timeStamp: T0 + 500,
      statusCode: 302,
      redirectUrl: URL_B,
      ip: '140.82.121.4',
    };
    const refined = harAttached(builder.observe(redirect));
    expect(refined).toHaveLength(1);
    if (refined[0]?.kind === 'har-attached') {
      expect(refined[0].hopIndex).toBe(0);
      expect(refined[0].har.serverIPAddress).toBe('140.82.121.4');
      expect(refined[0].har.response?.redirectURL).toBe(URL_B);
      expect(refined[0].har.time).toBe(500);
    }
    // Next hop starts at the redirect timestamp with fresh facts.
    const hop1 = observeAll(builder, [
      sendHeaders({ url: URL_B, timeStamp: T0 + 510, requestHeaders: [{ name: 'Accept', value: '*/*' }] }),
      headersReceived({ url: URL_B, timeStamp: T0 + 900 }),
    ]);
    const attached = harAttached(hop1);
    expect(attached[0]).toMatchObject({ hopIndex: 1 });
    if (attached[0]?.kind === 'har-attached') {
      expect(attached[0].har.startedDateTime).toBe(new Date(T0 + 500).toISOString());
      expect(attached[0].har.request?.headers).toEqual([{ name: 'Accept', value: '*/*' }]);
    }
  });
});

describe('WebRequestHarBuilder — floor timings', () => {
  it('the headers-received partial carries the open floor block; the terminal closes it', () => {
    const builder = new WebRequestHarBuilder();
    const updates = observeAll(builder, [start(), sendHeaders(), headersReceived(), errorOccurred()]);
    const attached = harAttached(updates);
    const partial = attached[0];
    const refined = attached[1];
    if (partial?.kind !== 'har-attached' || refined?.kind !== 'har-attached') throw new Error('expected har-attached');
    expect(partial.har.timings).toEqual({
      blocked: 400,
      dns: -1,
      connect: -1,
      ssl: -1,
      send: -1,
      wait: -1,
      receive: -1,
    });
    expect(refined.har.timings).toEqual({
      blocked: 400,
      dns: -1,
      connect: -1,
      ssl: -1,
      send: -1,
      wait: -1,
      receive: 1_600,
    });
  });

  it('each redirect hop gets its own floor block from its own instants', () => {
    const builder = new WebRequestHarBuilder();
    observeAll(builder, [start(), sendHeaders(), headersReceived({ statusCode: 302 })]);
    const redirect: WebRequestEvent = {
      method_kind: 'onBeforeRedirect',
      tabId: TAB,
      requestId: REQUEST_ID,
      url: URL_A,
      method: 'GET',
      type: 'main_frame',
      timeStamp: T0 + 500,
      statusCode: 302,
      redirectUrl: URL_B,
    };
    const hop0 = harAttached(builder.observe(redirect))[0];
    if (hop0?.kind !== 'har-attached') throw new Error('expected har-attached');
    expect(hop0.har.timings).toMatchObject({ blocked: 400, receive: 100 });
    const hop1 = harAttached(
      observeAll(builder, [
        sendHeaders({ url: URL_B, timeStamp: T0 + 510 }),
        headersReceived({ url: URL_B, timeStamp: T0 + 900 }),
      ]),
    )[0];
    if (hop1?.kind !== 'har-attached') throw new Error('expected har-attached');
    expect(hop1.har.timings).toMatchObject({ blocked: 400, receive: -1 });
  });
});

const RT_ORIGIN = T0 - 100;

function rtEntry(overrides: Partial<ResourceTimingEntry> = {}): ResourceTimingEntry {
  return {
    name: URL_A,
    initiatorType: 'navigation',
    nextHopProtocol: 'h2',
    startTime: 95,
    duration: 900,
    transferSize: 300,
    encodedBodySize: 0,
    decodedBodySize: 0,
    deliveryType: '',
    responseStatus: 200,
    workerStart: 0,
    redirectStart: 0,
    redirectEnd: 0,
    fetchStart: 100,
    domainLookupStart: 105,
    domainLookupEnd: 125,
    connectStart: 125,
    connectEnd: 185,
    secureConnectionStart: 145,
    requestStart: 190,
    responseStart: 495,
    firstInterimResponseStart: 0,
    finalResponseHeadersStart: 0,
    responseEnd: 995,
    ...overrides,
  };
}

function snapshot(
  entries: readonly ResourceTimingEntry[],
  navigation?: ResourceTimingEntry,
): ResourceTimingSnapshotEvent {
  return {
    kind: 'rt-snapshot',
    tabId: TAB,
    timeOriginMs: RT_ORIGIN,
    entries,
    ...(navigation !== undefined ? { navigation } : {}),
  };
}

describe('WebRequestHarBuilder — Resource Timing join', () => {
  it('the navigation entry upgrades the main_frame hop to the full ladder', () => {
    const builder = new WebRequestHarBuilder();
    observeAll(builder, [start(), sendHeaders(), headersReceived(), errorOccurred()]);
    const updates = harAttached(builder.observeResourceTiming(snapshot([], rtEntry())));
    expect(updates).toHaveLength(1);
    const refined = updates[0];
    if (refined?.kind !== 'har-attached') throw new Error('expected har-attached');
    expect(refined.har.timings).toMatchObject({ dns: 20, connect: 80, ssl: 40, send: 0, wait: 305 });
    expect(refined.har.timings?._blocked_queueing).toBe(5);
    // The terminal facts survive the re-emit.
    expect(refined.har.serverIPAddress).toBe('140.82.121.4');
    expect(refined.har.response?._error).toBe('net::ERR_ABORTED');
  });

  it('a canceled-mid-stream document closes receive at the terminal and flags the open download', () => {
    const builder = new WebRequestHarBuilder();
    observeAll(builder, [start(), sendHeaders(), headersReceived(), errorOccurred()]);
    const nav = rtEntry({ responseEnd: 0 });
    const refined = harAttached(builder.observeResourceTiming(snapshot([], nav)))[0];
    if (refined?.kind !== 'har-attached') throw new Error('expected har-attached');
    // terminal (T0+2000) − (origin + responseStart 495)
    expect(refined.har.timings?.receive).toBe(1_605);
    expect(refined.har.response?._responseBodyIncomplete).toBe(true);
  });

  it('a navigation entry never joins a non-main_frame hop, and a resource never joins the document', () => {
    const builder = new WebRequestHarBuilder();
    observeAll(builder, [
      start({ type: 'script' }),
      sendHeaders({ type: 'script' }),
      headersReceived({ type: 'script' }),
      completed({ type: 'script' }),
    ]);
    expect(builder.observeResourceTiming(snapshot([], rtEntry()))).toHaveLength(0);

    const docBuilder = new WebRequestHarBuilder();
    observeAll(docBuilder, [start(), sendHeaders(), headersReceived(), completed()]);
    expect(docBuilder.observeResourceTiming(snapshot([rtEntry({ initiatorType: 'script' })]))).toHaveLength(0);
  });

  it('a Timing-Allow-Origin-hidden entry leaves the floor standing (no re-emit)', () => {
    const builder = new WebRequestHarBuilder();
    observeAll(builder, [start(), sendHeaders(), headersReceived(), completed()]);
    const hidden = rtEntry({
      domainLookupStart: 0,
      domainLookupEnd: 0,
      connectStart: 0,
      connectEnd: 0,
      secureConnectionStart: 0,
      requestStart: 0,
      responseStart: 0,
    });
    expect(builder.observeResourceTiming(snapshot([], hidden))).toHaveLength(0);
  });

  it('the pairing is sticky: a later snapshot refreshes the same entry, re-emitting only on change', () => {
    const builder = new WebRequestHarBuilder();
    observeAll(builder, [start(), sendHeaders(), headersReceived(), errorOccurred()]);
    const open = rtEntry({ responseEnd: 0 });
    expect(harAttached(builder.observeResourceTiming(snapshot([], open)))).toHaveLength(1);
    // Identical snapshot — nothing changed, nothing re-emitted.
    expect(builder.observeResourceTiming(snapshot([], open))).toHaveLength(0);
    // The response end lands (same entry identity) — one refreshed re-emit.
    const closed = rtEntry({ responseEnd: 1_995 });
    const refreshed = harAttached(builder.observeResourceTiming(snapshot([], closed)));
    expect(refreshed).toHaveLength(1);
    if (refreshed[0]?.kind !== 'har-attached') throw new Error('expected har-attached');
    expect(refreshed[0].har.timings?.receive).toBe(1_500);
    expect(refreshed[0].har.response?._responseBodyIncomplete).toBeUndefined();
  });

  it('a superseded hop joins silently — the devtools HAR stays authoritative', () => {
    const builder = new WebRequestHarBuilder();
    observeAll(builder, [start(), sendHeaders(), headersReceived(), completed()]);
    builder.noteRealHar(TAB, REQUEST_ID, 0);
    expect(builder.observeResourceTiming(snapshot([], rtEntry()))).toHaveLength(0);
  });

  it('same-URL entries pair with the closest request start', () => {
    const builder = new WebRequestHarBuilder();
    const scriptEvents = (requestId: string, atMs: number): WebRequestEvent[] => [
      start({ requestId, type: 'script', timeStamp: atMs }),
      sendHeaders({ requestId, type: 'script', timeStamp: atMs + 10 }),
      headersReceived({ requestId, type: 'script', timeStamp: atMs + 400 }),
      completed({ requestId, type: 'script', timeStamp: atMs + 800 }),
    ];
    observeAll(builder, [...scriptEvents('wr-early', T0), ...scriptEvents('wr-late', T0 + 5_000)]);
    const early = rtEntry({ initiatorType: 'script', startTime: 95 });
    const late = rtEntry({ initiatorType: 'script', startTime: 5_095, responseEnd: 5_995 });
    const updates = harAttached(builder.observeResourceTiming(snapshot([late, early])));
    expect(updates.map((u) => u.kind === 'har-attached' && u.requestId).sort()).toEqual(['wr-early', 'wr-late']);
  });

  it('entries with a mismatched recorded status never pair', () => {
    const builder = new WebRequestHarBuilder();
    observeAll(builder, [start(), sendHeaders(), headersReceived({ statusCode: 404 }), completed()]);
    expect(builder.observeResourceTiming(snapshot([], rtEntry({ responseStatus: 200 })))).toHaveLength(0);
  });
});

describe('WebRequestHarBuilder — bookkeeping', () => {
  it('forgetTab drops all state', () => {
    const builder = new WebRequestHarBuilder();
    builder.observe(start());
    builder.observe(start({ requestId: 'wr-2' }));
    expect(builder.size()).toBe(2);
    builder.forgetTab(TAB);
    expect(builder.size()).toBe(0);
  });
});
