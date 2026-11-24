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
    // The heuristic path has no raw protocol instants — a synthesized entry
    // never grows a `_rawTiming` block (the ladder's raw decode is CDP-only;
    // the export dialect stays this path's honest floor).
    expect(update.har).not.toHaveProperty('_rawTiming');
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

  it('keeps the advanced hop index when the redirect target re-fires onBeforeRequest', () => {
    const builder = new WebRequestHarBuilder();
    observeAll(builder, [
      start(),
      sendHeaders(),
      headersReceived({
        statusCode: 302,
        statusLine: 'HTTP/1.1 302 Found',
        responseHeaders: [{ name: 'Location', value: URL_B }],
      }),
      {
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
      },
    ]);
    // Chrome re-fires onBeforeRequest for the redirect target under the same
    // requestId. The next hop must keep hop index 1 (not reset to 0) and take
    // its start from this event, not the redirect instant.
    const hop1 = observeAll(builder, [
      start({ url: URL_B, timeStamp: T0 + 505 }),
      sendHeaders({ url: URL_B, timeStamp: T0 + 510, requestHeaders: [{ name: 'Accept', value: '*/*' }] }),
      headersReceived({ url: URL_B, timeStamp: T0 + 900 }),
    ]);
    const attached = harAttached(hop1);
    expect(attached).toHaveLength(1);
    if (attached[0]?.kind !== 'har-attached') throw new Error('expected har-attached');
    expect(attached[0].hopIndex).toBe(1);
    expect(attached[0].har.startedDateTime).toBe(new Date(T0 + 505).toISOString());
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

describe('WebRequestHarBuilder — sizes on a tab with no finished-request feed', () => {
  const LENGTH = { name: 'Content-Length', value: '2048' };
  const TYPE = { name: 'Content-Type', value: 'text/html' };

  function lastHar(updates: readonly RequestLifecycleUpdate[]) {
    const last = harAttached(updates).at(-1);
    if (last?.kind !== 'har-attached') throw new Error('expected har-attached');
    return last.har;
  }

  function feedless(): WebRequestHarBuilder {
    const builder = new WebRequestHarBuilder();
    builder.noteHarFeedAbsent(TAB);
    return builder;
  }

  it('a tab that never declared it keeps every partial size-less, whatever the page and the wire recorded', () => {
    const builder = new WebRequestHarBuilder();
    const har = lastHar(
      observeAll(builder, [start(), sendHeaders(), headersReceived({ responseHeaders: [TYPE, LENGTH] }), completed()]),
    );
    expect(har.response?._transferSize).toBeUndefined();
    expect(har.response?.bodySize).toBe(-1);
    expect(har.response?.content.size).toBe(0);
    // The page's sizes change nothing either: the join re-emits for the
    // timing ladder alone.
    const sized = rtEntry({ transferSize: 30_357, encodedBodySize: 30_057, decodedBodySize: 125_253 });
    const joined = lastHar(builder.observeResourceTiming(snapshot([], sized)));
    expect(joined.response?._transferSize).toBeUndefined();
    expect(joined.response?.bodySize).toBe(-1);
    expect(joined.response?.content.size).toBe(0);
  });

  it("takes the page's own record when it exposes one", () => {
    const builder = feedless();
    observeAll(builder, [start(), sendHeaders(), headersReceived(), completed()]);
    const sized = rtEntry({ transferSize: 30_357, encodedBodySize: 30_057, decodedBodySize: 125_253 });
    const har = lastHar(builder.observeResourceTiming(snapshot([], sized)));
    expect(har.response?._transferSize).toBe(30_357);
    expect(har.response?.bodySize).toBe(30_057);
    expect(har.response?.content.size).toBe(125_253);
    expect(har._ohEntrySource).toBe('webrequest-partial');
  });

  it('re-emits when only the sizes changed on the paired entry', () => {
    const builder = feedless();
    observeAll(builder, [start(), sendHeaders(), headersReceived(), completed()]);
    expect(harAttached(builder.observeResourceTiming(snapshot([], rtEntry({ transferSize: 0 }))))).toHaveLength(1);
    const sized = rtEntry({ transferSize: 30_357, encodedBodySize: 30_057, decodedBodySize: 125_253 });
    const refreshed = harAttached(builder.observeResourceTiming(snapshot([], sized)));
    expect(refreshed).toHaveLength(1);
    expect(builder.observeResourceTiming(snapshot([], sized))).toHaveLength(0);
  });

  it('falls back to the declared body length once the hop completes', () => {
    const builder = feedless();
    const atHeaders = lastHar(
      observeAll(builder, [start(), sendHeaders(), headersReceived({ responseHeaders: [TYPE, LENGTH] })]),
    );
    // Nothing has been delivered yet — the declared length is not a count.
    expect(atHeaders.response?.bodySize).toBe(-1);
    const done = lastHar(builder.observe(completed()));
    expect(done.response?.bodySize).toBe(2_048);
    expect(done.response?.content.size).toBe(2_048);
    expect(done.response?._transferSize).toBeUndefined();
  });

  it('leaves the decoded size unknown when the body travelled encoded', () => {
    const builder = feedless();
    const gzip = { name: 'content-encoding', value: 'gzip' };
    observeAll(builder, [start(), sendHeaders(), headersReceived({ responseHeaders: [TYPE, LENGTH, gzip] })]);
    const done = lastHar(builder.observe(completed()));
    expect(done.response?.bodySize).toBe(2_048);
    expect(done.response?.content.size).toBe(0);
  });

  it('a page entry hidden by the Timing-Allow-Origin check leaves the declared length standing', () => {
    const builder = feedless();
    observeAll(builder, [start(), sendHeaders(), headersReceived({ responseHeaders: [TYPE, LENGTH] }), completed()]);
    const hidden = rtEntry({ transferSize: 0, requestStart: 0 });
    expect(builder.observeResourceTiming(snapshot([], hidden))).toHaveLength(0);
  });

  it.each([
    [
      'a HEAD request',
      () => [
        start({ method: 'HEAD' }),
        headersReceived({ method: 'HEAD', responseHeaders: [LENGTH] }),
        completed({ method: 'HEAD' }),
      ],
    ],
    [
      'a 304',
      () => [start(), headersReceived({ statusCode: 304, responseHeaders: [LENGTH] }), completed({ statusCode: 304 })],
    ],
    [
      'a 204',
      () => [start(), headersReceived({ statusCode: 204, responseHeaders: [LENGTH] }), completed({ statusCode: 204 })],
    ],
    [
      'a cache-served hop',
      () => [start(), headersReceived({ responseHeaders: [LENGTH] }), completed({ fromCache: true })],
    ],
    ['a failed hop', () => [start(), headersReceived({ responseHeaders: [LENGTH] }), errorOccurred()]],
    [
      'a malformed length',
      () => [start(), headersReceived({ responseHeaders: [{ name: 'Content-Length', value: '12, 12' }] }), completed()],
    ],
  ] as const)('declares no size for %s', (_label, events) => {
    const har = lastHar(observeAll(feedless(), events()));
    expect(har.response?.bodySize).toBe(-1);
    expect(har.response?.content.size).toBe(0);
    expect(har.response?._transferSize).toBeUndefined();
  });

  it('forgetTab drops the declaration with the tab', () => {
    const builder = feedless();
    builder.forgetTab(TAB);
    const har = lastHar(
      observeAll(builder, [start(), sendHeaders(), headersReceived({ responseHeaders: [TYPE, LENGTH] }), completed()]),
    );
    expect(har.response?.bodySize).toBe(-1);
  });

  it('marks every partial of such a tab as never getting a body, from the first emission', () => {
    const builder = feedless();
    const atHeaders = lastHar(observeAll(builder, [start(), sendHeaders(), headersReceived()]));
    expect(atHeaders._ohBodyUnavailable).toBe(true);
    expect(lastHar(builder.observe(completed()))._ohBodyUnavailable).toBe(true);
  });

  it('a tab that never declared it carries no such mark', () => {
    const har = lastHar(
      observeAll(new WebRequestHarBuilder(), [start(), sendHeaders(), headersReceived(), completed()]),
    );
    expect(har).not.toHaveProperty('_ohBodyUnavailable');
  });
});

describe('WebRequestHarBuilder — a hop that ran with its tab’s feed closed', () => {
  const LENGTH = { name: 'Content-Length', value: '2048' };
  const TYPE = { name: 'Content-Type', value: 'text/html' };

  function lastHar(updates: readonly RequestLifecycleUpdate[]) {
    const last = harAttached(updates).at(-1);
    if (last?.kind !== 'har-attached') throw new Error('expected har-attached');
    return last.har;
  }

  /** A builder on a host that tracks its feeds; `feed.live` is the tab's answer. */
  function tracked(live: boolean) {
    const feed = { live };
    return { feed, builder: new WebRequestHarBuilder(() => feed.live) };
  }

  const sized = () => headersReceived({ responseHeaders: [TYPE, LENGTH] });

  it('stays loading while it is in flight — no mark, no size', () => {
    const { builder } = tracked(false);
    const atHeaders = lastHar(observeAll(builder, [start(), sendHeaders(), sized()]));
    expect(atHeaders).not.toHaveProperty('_ohBodyUnavailable');
    expect(atHeaders).not.toHaveProperty('_ohFeedClosed');
    expect(atHeaders.response?.bodySize).toBe(-1);
  });

  it('is final once it ends: marked, and carrying the declared length', () => {
    const { builder } = tracked(false);
    observeAll(builder, [start(), sendHeaders(), sized()]);
    const done = lastHar(builder.observe(completed()));
    expect(done._ohBodyUnavailable).toBe(true);
    expect(done._ohFeedClosed).toBe(true);
    expect(done.response?.bodySize).toBe(2_048);
    expect(done.response?.content.size).toBe(2_048);
  });

  it('a hop that ran with the feed open is left waiting for its entry', () => {
    const { builder } = tracked(true);
    const done = lastHar(observeAll(builder, [start(), sendHeaders(), sized(), completed()]));
    expect(done).not.toHaveProperty('_ohBodyUnavailable');
    expect(done).not.toHaveProperty('_ohFeedClosed');
    expect(done.response?.bodySize).toBe(-1);
  });

  it('a hop that started before the feed opened is final at its end — the feed never saw it start', () => {
    const { builder, feed } = tracked(false);
    observeAll(builder, [start(), sendHeaders(), sized()]);
    feed.live = true;
    const done = lastHar(builder.observe(completed()));
    expect(done._ohFeedClosed).toBe(true);
    expect(done.response?.bodySize).toBe(2_048);
  });

  it('a hop whose feed closed before it ended is final at its end', () => {
    const { builder, feed } = tracked(true);
    observeAll(builder, [start(), sendHeaders(), sized()]);
    feed.live = false;
    expect(lastHar(builder.observe(completed()))._ohFeedClosed).toBe(true);
  });

  it('a failed hop is final too, with no size to declare', () => {
    const { builder } = tracked(false);
    observeAll(builder, [start(), sendHeaders(), sized()]);
    const failed = lastHar(builder.observe(errorOccurred()));
    expect(failed._ohFeedClosed).toBe(true);
    expect(failed.response?.bodySize).toBe(-1);
  });

  it('the feed closing re-emits the hops that had ended still waiting for their entry', () => {
    const { builder, feed } = tracked(true);
    observeAll(builder, [start(), sendHeaders(), sized(), completed()]);
    feed.live = false;
    const updates = harAttached(builder.noteHarFeedClosed(TAB));
    expect(updates).toHaveLength(1);
    const har = lastHar(updates);
    expect(har._ohBodyUnavailable).toBe(true);
    expect(har._ohFeedClosed).toBe(true);
    expect(har.response?.bodySize).toBe(2_048);
  });

  it('the feed closing leaves a hop in flight alone, and it goes final at its own end', () => {
    const { builder, feed } = tracked(true);
    observeAll(builder, [start(), sendHeaders(), sized()]);
    feed.live = false;
    expect(builder.noteHarFeedClosed(TAB)).toHaveLength(0);
    // Reopened before the hop ends: the new feed never saw it start.
    feed.live = true;
    expect(lastHar(builder.observe(completed()))._ohFeedClosed).toBe(true);
  });

  it('the feed closing never re-emits a hop its devtools entry already claimed', () => {
    const { builder, feed } = tracked(true);
    observeAll(builder, [start(), sendHeaders(), sized(), completed()]);
    builder.noteRealHar(TAB, REQUEST_ID, 0);
    feed.live = false;
    expect(builder.noteHarFeedClosed(TAB)).toHaveLength(0);
  });

  it('the feed closing says nothing twice', () => {
    const { builder } = tracked(false);
    observeAll(builder, [start(), sendHeaders(), sized(), completed()]);
    expect(builder.noteHarFeedClosed(TAB)).toHaveLength(0);
  });

  it('the feed closing on a tab with nothing tracked is a no-op', () => {
    expect(tracked(false).builder.noteHarFeedClosed(TAB)).toHaveLength(0);
  });

  it('each hop of a redirect chain reads the feed afresh', () => {
    const { builder, feed } = tracked(false);
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
    // The feed opens just before the redirect: hop 0 started without it.
    feed.live = true;
    const hop0 = harAttached(builder.observe(redirect)).at(-1);
    if (hop0?.kind !== 'har-attached') throw new Error('expected har-attached');
    expect(hop0.hopIndex).toBe(0);
    expect(hop0.har._ohFeedClosed).toBe(true);
    // Hop 1 runs wholly under the open feed.
    const hop1 = harAttached(
      observeAll(builder, [
        start({ url: URL_B, timeStamp: T0 + 500 }),
        sendHeaders({ url: URL_B, timeStamp: T0 + 510 }),
        headersReceived({ url: URL_B, timeStamp: T0 + 900 }),
        completed({ url: URL_B }),
      ]),
    ).at(-1);
    if (hop1?.kind !== 'har-attached') throw new Error('expected har-attached');
    expect(hop1.hopIndex).toBe(1);
    expect(hop1.har).not.toHaveProperty('_ohBodyUnavailable');
    expect(hop1.har).not.toHaveProperty('_ohFeedClosed');
  });

  it('a host with no feed at all keeps its own reason, and is not re-emitted when its port closes', () => {
    const { builder } = tracked(false);
    builder.noteHarFeedAbsent(TAB);
    const atHeaders = lastHar(observeAll(builder, [start(), sendHeaders(), sized()]));
    expect(atHeaders._ohBodyUnavailable).toBe(true);
    expect(atHeaders).not.toHaveProperty('_ohFeedClosed');
    const done = lastHar(builder.observe(completed()));
    expect(done._ohBodyUnavailable).toBe(true);
    expect(done).not.toHaveProperty('_ohFeedClosed');
    expect(builder.noteHarFeedClosed(TAB)).toHaveLength(0);
  });

  it('a host that does not track its feeds leaves every hop waiting', () => {
    const builder = new WebRequestHarBuilder();
    const done = lastHar(observeAll(builder, [start(), sendHeaders(), sized(), completed()]));
    expect(done).not.toHaveProperty('_ohBodyUnavailable');
    expect(done.response?.bodySize).toBe(-1);
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
