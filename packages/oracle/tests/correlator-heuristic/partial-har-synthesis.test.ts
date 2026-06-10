/**
 * Partial-HAR synthesis from webRequest wire facts — end-to-end through
 * `HeuristicCorrelator` → `RequestLifecycleStore`.
 *
 * The canonical scenario is a document canceled mid-stream: webRequest
 * reports start → sendHeaders → headersReceived → errorOccurred, but the
 * devtools `onRequestFinished` never fires (no terminal on the CDP
 * plane), so no HAR ever joins. The row's detail tabs read from the HAR
 * slot, which stayed empty — the partial entry synthesized from the
 * captured wire facts fills it, and a joined devtools HAR supersedes the
 * partial per hop when one does land.
 */

import type { RequestLifecycleUpdate } from '@openheaders/core/request-lifecycle';
import type { InspectorHarEntry } from '@openheaders/core/types';
import { describe, expect, it, vi } from 'vitest';

import { HeuristicCorrelator } from '../../src/correlator-heuristic/correlator';
import type { WebRequestEvent, WebRequestEventSource } from '../../src/correlator-heuristic/events';
import type { HarEvent, HarEventSource } from '../../src/correlator-heuristic/har-events';
import { RequestLifecycleStore } from '../../src/request-lifecycle-store';

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
}

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
}

const TAB = 7;
const REQUEST_ID = 'wr-doc';
const DOC_URL = 'https://app.openheaders.io/';
const T0 = 1_700_000_000_000;

function harness() {
  const webRequest = new TestWebRequestSource();
  const har = new TestHarSource();
  const correlator = new HeuristicCorrelator({ webRequest, har });
  const onReject = vi.fn();
  const store = new RequestLifecycleStore({ onReject });
  correlator.subscribe((u: RequestLifecycleUpdate) => store.apply(u));
  correlator.attachTab(TAB);
  return { webRequest, har, correlator, store, onReject };
}

/** The canceled-mid-stream document trace (no devtools HAR ever arrives). */
function canceledDocTrace(): readonly WebRequestEvent[] {
  return [
    {
      method_kind: 'onBeforeRequest',
      tabId: TAB,
      requestId: REQUEST_ID,
      url: DOC_URL,
      method: 'GET',
      type: 'main_frame',
      timeStamp: T0,
    },
    {
      method_kind: 'onSendHeaders',
      tabId: TAB,
      requestId: REQUEST_ID,
      url: DOC_URL,
      method: 'GET',
      type: 'main_frame',
      timeStamp: T0 + 10,
      requestHeaders: [
        { name: 'Accept', value: 'text/html' },
        { name: 'Cookie', value: 'sid=abc' },
      ],
    },
    {
      method_kind: 'onHeadersReceived',
      tabId: TAB,
      requestId: REQUEST_ID,
      url: DOC_URL,
      method: 'GET',
      type: 'main_frame',
      timeStamp: T0 + 490,
      statusCode: 200,
      statusLine: 'HTTP/1.1 200 OK',
      responseHeaders: [
        { name: 'Content-Type', value: 'text/html; charset=utf-8' },
        { name: 'Cache-Control', value: 'no-cache' },
      ],
    },
    {
      method_kind: 'onErrorOccurred',
      tabId: TAB,
      requestId: REQUEST_ID,
      url: DOC_URL,
      method: 'GET',
      type: 'main_frame',
      timeStamp: T0 + 2_010,
      error: 'net::ERR_ABORTED',
      ip: '140.82.121.4',
    },
  ];
}

describe('partial-HAR synthesis — canceled-mid-stream document (never-joined)', () => {
  it('the row carries a partial HAR with wire headers, ip, error, and time', () => {
    const { webRequest, correlator, store, onReject } = harness();
    for (const event of canceledDocTrace()) webRequest.emit(event);

    const lc = store.get(TAB, REQUEST_ID);
    if (lc === undefined) throw new Error('expected lifecycle');
    expect(onReject).not.toHaveBeenCalled();
    expect(lc.phase).toBe('failed');
    expect(lc.statusCode).toBe(200);

    const har = lc.har[0];
    if (har == null) throw new Error('expected partial HAR at hop 0');
    expect(har.response?.status).toBe(200);
    expect(har.response?.statusText).toBe('OK');
    expect(har.response?.headers).toEqual([
      { name: 'Content-Type', value: 'text/html; charset=utf-8' },
      { name: 'Cache-Control', value: 'no-cache' },
    ]);
    expect(har.request?.headers).toEqual([
      { name: 'Accept', value: 'text/html' },
      { name: 'Cookie', value: 'sid=abc' },
    ]);
    expect(har.request?.cookies).toEqual([{ name: 'sid', value: 'abc' }]);
    expect(har.response?.content.mimeType).toBe('text/html');
    expect(har.serverIPAddress).toBe('140.82.121.4');
    expect(har.response?._error).toBe('net::ERR_ABORTED');
    expect(har.time).toBe(2_010);
    expect(har._resourceType).toBe('document');
    // No invented bytes: the Size column must stay honestly empty.
    expect(har.response?._transferSize).toBeUndefined();

    correlator.dispose();
  });

  it('classification is untouched: status stays 200, the error stays the webRequest verdict', () => {
    const { webRequest, correlator, store } = harness();
    for (const event of canceledDocTrace()) webRequest.emit(event);
    const lc = store.get(TAB, REQUEST_ID);
    expect(lc?.error?.code).toBe('net::ERR_ABORTED');
    expect(lc?.statusText).toBe('OK');
    correlator.dispose();
  });
});

describe('partial-HAR synthesis — joined devtools HAR supersedes the partial', () => {
  function joinedEntry(): InspectorHarEntry {
    return {
      startedDateTime: new Date(T0).toISOString(),
      time: 1_988.2,
      _resourceType: 'document',
      request: { method: 'GET', url: DOC_URL, headers: [{ name: 'Accept', value: 'text/html' }], queryString: [] },
      response: {
        status: 200,
        statusText: 'OK',
        headers: [{ name: 'Content-Type', value: 'text/html; charset=utf-8' }],
        content: { size: 131_072, mimeType: 'text/html' },
        _transferSize: 131_426,
      },
    };
  }

  it('a HAR joining before the terminal owns the slot; the refinement never overwrites it', () => {
    const { webRequest, har, correlator, store } = harness();
    const [start, send, headers, error] = canceledDocTrace();
    if (!start || !send || !headers || !error) throw new Error('trace shape');
    webRequest.emit(start);
    webRequest.emit(send);
    webRequest.emit(headers);
    // The devtools HAR lands while the request is still in flight.
    har.emit({ kind: 'har-entry', tabId: TAB, entry: joinedEntry() });
    webRequest.emit(error);

    const lc = store.get(TAB, REQUEST_ID);
    // The authoritative joined entry keeps the slot — its transfer size
    // survives, which the partial (no byte counts) would have erased.
    expect(lc?.har[0]?.response?._transferSize).toBe(131_426);
    expect(lc?.har[0]?.time).toBe(1_988.2);
    correlator.dispose();
  });

  it('a HAR joining after the terminal overwrites the refined partial (slot semantics)', () => {
    const { webRequest, har, correlator, store } = harness();
    for (const event of canceledDocTrace()) webRequest.emit(event);
    har.emit({ kind: 'har-entry', tabId: TAB, entry: joinedEntry() });

    const lc = store.get(TAB, REQUEST_ID);
    expect(lc?.har[0]?.response?._transferSize).toBe(131_426);
    correlator.dispose();
  });
});
