/**
 * `WebRequestHarBuilder` — stateful partial-HAR synthesis across the
 * webRequest hop lifecycle: partial at `onHeadersReceived`, refined at
 * the hop terminal, superseded per hop by a joined devtools HAR.
 */

import type { RequestLifecycleUpdate } from '@openheaders/core/request-lifecycle';
import { describe, expect, it } from 'vitest';

import type { WebRequestEvent } from '../../src/correlator-heuristic/events';
import { WebRequestHarBuilder } from '../../src/correlator-heuristic/webrequest-har-builder';

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
  it('re-emits refined with ip, error, and total time at onErrorOccurred, then forgets', () => {
    const builder = new WebRequestHarBuilder();
    const updates = observeAll(builder, [start(), sendHeaders(), headersReceived(), errorOccurred()]);
    const attached = harAttached(updates);
    expect(attached).toHaveLength(2);
    const refined = attached[1];
    if (refined?.kind !== 'har-attached') throw new Error('expected har-attached');
    expect(refined.har.serverIPAddress).toBe('140.82.121.4');
    expect(refined.har.response?._error).toBe('net::ERR_ABORTED');
    expect(refined.har.time).toBe(2_000);
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
