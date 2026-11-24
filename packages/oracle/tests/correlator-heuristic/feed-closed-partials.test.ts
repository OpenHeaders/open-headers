/**
 * A hop that ran with its tab's devtools feed closed — end-to-end through
 * `HeuristicCorrelator` → `RequestLifecycleStore`.
 *
 * The canonical scenario is a tab watched from outside the browser with
 * its DevTools closed: webRequest reports the whole exchange, but nothing
 * is there to hand over the finished entry or the body. The row's partial
 * entry goes final when the hop ends — it carries the declared length and
 * says no body will attach — while a hop still in flight keeps waiting.
 */

import type { RequestLifecycleUpdate } from '@openheaders/core/request-lifecycle';
import type { InspectorHarEntry } from '@openheaders/core/types';
import { describe, expect, it } from 'vitest';

import { HeuristicCorrelator } from '../../src/correlator-heuristic/correlator';
import type { WebRequestEvent, WebRequestEventSource } from '../../src/correlator-heuristic/events';
import type {
  HarEvent,
  HarEventSource,
  HarPresenceEvent,
  HarPresenceSource,
} from '../../src/correlator-heuristic/har-events';
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

/** The host's devtools feed: entries, plus the feed opening and closing. */
class TestHarFeed implements HarEventSource, HarPresenceSource {
  private readonly listeners = new Set<(event: HarEvent) => void>();
  private readonly presenceListeners = new Set<(event: HarPresenceEvent) => void>();

  subscribe(listener: (event: HarEvent) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  subscribePresence(listener: (event: HarPresenceEvent) => void): () => void {
    this.presenceListeners.add(listener);
    return () => {
      this.presenceListeners.delete(listener);
    };
  }

  emit(event: HarEvent): void {
    for (const fn of this.listeners) fn(event);
  }

  open(tabId: number): void {
    for (const fn of this.presenceListeners) fn({ kind: 'tab-har-active', tabId });
  }

  close(tabId: number): void {
    for (const fn of this.presenceListeners) fn({ kind: 'tab-har-inactive', tabId });
  }

  presenceListenerCount(): number {
    return this.presenceListeners.size;
  }
}

const TAB = 7;
const REQUEST_ID = 'wr-api';
const API_URL = 'https://api.openheaders.io/v2/config';
const T0 = 1_700_000_000_000;

function harness(options: { trackFeeds: boolean } = { trackFeeds: true }) {
  const webRequest = new TestWebRequestSource();
  const feed = new TestHarFeed();
  const correlator = new HeuristicCorrelator({
    webRequest,
    har: feed,
    ...(options.trackFeeds ? { harPresence: feed } : {}),
  });
  const store = new RequestLifecycleStore();
  correlator.subscribe((u: RequestLifecycleUpdate) => store.apply(u));
  return { webRequest, feed, correlator, store };
}

/** start → sendHeaders → headersReceived: the response is arriving. */
function inFlightTrace(): readonly WebRequestEvent[] {
  return [
    {
      method_kind: 'onBeforeRequest',
      tabId: TAB,
      requestId: REQUEST_ID,
      url: API_URL,
      method: 'GET',
      type: 'xmlhttprequest',
      timeStamp: T0,
    },
    {
      method_kind: 'onSendHeaders',
      tabId: TAB,
      requestId: REQUEST_ID,
      url: API_URL,
      method: 'GET',
      type: 'xmlhttprequest',
      timeStamp: T0 + 5,
      requestHeaders: [{ name: 'Accept', value: 'application/json' }],
    },
    {
      method_kind: 'onHeadersReceived',
      tabId: TAB,
      requestId: REQUEST_ID,
      url: API_URL,
      method: 'GET',
      type: 'xmlhttprequest',
      timeStamp: T0 + 120,
      statusCode: 200,
      statusLine: 'HTTP/1.1 200 OK',
      responseHeaders: [
        { name: 'Content-Type', value: 'application/json' },
        { name: 'Content-Length', value: '512' },
      ],
    },
  ];
}

function completedEvent(): WebRequestEvent {
  return {
    method_kind: 'onCompleted',
    tabId: TAB,
    requestId: REQUEST_ID,
    url: API_URL,
    method: 'GET',
    type: 'xmlhttprequest',
    timeStamp: T0 + 300,
    statusCode: 200,
    statusLine: 'HTTP/1.1 200 OK',
    ip: '140.82.121.4',
  };
}

function devtoolsEntry(): InspectorHarEntry {
  return {
    startedDateTime: new Date(T0).toISOString(),
    time: 300,
    request: { method: 'GET', url: API_URL, headers: [], queryString: [] },
    response: {
      status: 200,
      statusText: 'OK',
      headers: [],
      content: { size: 1_900, mimeType: 'application/json' },
      bodySize: 512,
      _transferSize: 730,
    },
  };
}

function storedHar(store: RequestLifecycleStore): InspectorHarEntry {
  const har = store.get(TAB, REQUEST_ID)?.har[0];
  if (har == null) throw new Error('expected the row to hold a HAR entry');
  return har;
}

describe('HeuristicCorrelator — a tab whose devtools feed is closed', () => {
  it('a hop in flight keeps waiting: its partial carries no mark', () => {
    const { webRequest, correlator, store } = harness();
    correlator.attachTab(TAB);
    for (const event of inFlightTrace()) webRequest.emit(event);
    const har = storedHar(store);
    expect(har._ohEntrySource).toBe('webrequest-partial');
    expect(har).not.toHaveProperty('_ohBodyUnavailable');
  });

  it('the finished hop is final: marked, with the declared length', () => {
    const { webRequest, correlator, store } = harness();
    correlator.attachTab(TAB);
    for (const event of inFlightTrace()) webRequest.emit(event);
    webRequest.emit(completedEvent());
    const har = storedHar(store);
    expect(har._ohBodyUnavailable).toBe(true);
    expect(har._ohFeedClosed).toBe(true);
    expect(har.response?.bodySize).toBe(512);
    expect(store.get(TAB, REQUEST_ID)?.phase).toBe('completed');
  });

  it('a feed that opened before the tab attached counts — presence is folded for every tab', () => {
    const { webRequest, feed, correlator, store } = harness();
    feed.open(TAB);
    correlator.attachTab(TAB);
    for (const event of inFlightTrace()) webRequest.emit(event);
    webRequest.emit(completedEvent());
    expect(storedHar(store)).not.toHaveProperty('_ohBodyUnavailable');
  });

  it('a feed survives its tab leaving this correlator and coming back', () => {
    const { webRequest, feed, correlator, store } = harness();
    correlator.attachTab(TAB);
    feed.open(TAB);
    correlator.detachTab(TAB);
    correlator.attachTab(TAB);
    for (const event of inFlightTrace()) webRequest.emit(event);
    webRequest.emit(completedEvent());
    expect(storedHar(store)).not.toHaveProperty('_ohBodyUnavailable');
  });

  it('the feed closing after the hop ended turns its waiting partial final', () => {
    const { webRequest, feed, correlator, store } = harness();
    correlator.attachTab(TAB);
    feed.open(TAB);
    for (const event of inFlightTrace()) webRequest.emit(event);
    webRequest.emit(completedEvent());
    expect(storedHar(store)).not.toHaveProperty('_ohBodyUnavailable');
    feed.close(TAB);
    expect(storedHar(store)._ohFeedClosed).toBe(true);
    expect(storedHar(store).response?.bodySize).toBe(512);
  });

  it('the feed closing leaves a joined devtools entry in its slot', () => {
    const { webRequest, feed, correlator, store } = harness();
    correlator.attachTab(TAB);
    feed.open(TAB);
    for (const event of inFlightTrace()) webRequest.emit(event);
    webRequest.emit(completedEvent());
    feed.emit({ kind: 'har-entry', tabId: TAB, entry: devtoolsEntry() });
    feed.close(TAB);
    const har = storedHar(store);
    expect(har._ohEntrySource).toBe('devtools');
    expect(har.response?._transferSize).toBe(730);
    expect(har).not.toHaveProperty('_ohBodyUnavailable');
  });

  it('a devtools entry that does arrive replaces the final partial', () => {
    const { webRequest, feed, correlator, store } = harness();
    correlator.attachTab(TAB);
    for (const event of inFlightTrace()) webRequest.emit(event);
    webRequest.emit(completedEvent());
    expect(storedHar(store)._ohFeedClosed).toBe(true);
    // The worker restarted with DevTools open: the page reconnects with the entry.
    feed.open(TAB);
    feed.emit({ kind: 'har-entry', tabId: TAB, entry: devtoolsEntry() });
    const har = storedHar(store);
    expect(har._ohEntrySource).toBe('devtools');
    expect(har).not.toHaveProperty('_ohBodyUnavailable');
    expect(har).not.toHaveProperty('_ohFeedClosed');
  });

  it('a host that reports no presence leaves its partials waiting, as before', () => {
    const { webRequest, correlator, store } = harness({ trackFeeds: false });
    correlator.attachTab(TAB);
    for (const event of inFlightTrace()) webRequest.emit(event);
    webRequest.emit(completedEvent());
    const har = storedHar(store);
    expect(har).not.toHaveProperty('_ohBodyUnavailable');
    expect(har.response?.bodySize).toBe(-1);
  });

  it('dispose stops listening for presence', () => {
    const { feed, correlator } = harness();
    expect(feed.presenceListenerCount()).toBe(1);
    correlator.dispose();
    expect(feed.presenceListenerCount()).toBe(0);
  });
});
