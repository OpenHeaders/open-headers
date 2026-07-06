/**
 * Chrome adapter implementing `WebRequestEventSource` (the oracle seam).
 *
 * Sole responsibility: subscribe to all six `chrome.webRequest.*` events
 * the heuristic correlator consumes, normalize each callback's `details`
 * into the oracle-shaped {@link WebRequestEvent}, and fan out to
 * subscribers.
 *
 * This is the only place in the codebase that calls
 * `chrome.webRequest.*.addListener` for the lifecycle pipeline
 * (invariant 7) — the sole webRequest subscriber across the extension.
 *
 * Two fan-out channels share the one set of chrome listeners:
 * `subscribe` carries tab-bound traffic to the lifecycle pipeline;
 * `subscribeExtensionTraffic` carries the extension's own SW fetches
 * (`tabId === -1`, own-origin initiator) to the request executor's
 * wire capture. All other tab-less traffic is dropped.
 *
 * Cross-browser: uses `getBrowserAPI()` for Firefox/Chrome/Safari/Edge.
 * The polyfill exposes the chrome-shaped API everywhere.
 */

import type {
  OnBeforeRedirectEvent,
  OnBeforeRequestEvent,
  OnCompletedEvent,
  OnErrorOccurredEvent,
  OnHeadersReceivedEvent,
  OnSendHeadersEvent,
  WebRequestEvent,
  WebRequestEventSource,
  WebRequestHeader,
} from '@openheaders/oracle/correlator-heuristic';
import { isFirefox } from '@utils/browser-api';
import { logger } from '@utils/logger';
import { getBrowserAPI } from '@/types/browser';

type Listener = (event: WebRequestEvent) => void;

/** Filter for every listener — every URL, every tab. The correlator gates per-tab. */
const ALL_URLS_FILTER: chrome.webRequest.RequestFilter = { urls: ['<all_urls>'] };

export class ChromeWebRequestEventSource implements WebRequestEventSource {
  private readonly listeners = new Set<Listener>();
  private readonly extensionTrafficListeners = new Set<Listener>();
  private readonly unsubscribes: Array<() => void> = [];
  private installed = false;
  private ownOrigin: string | undefined;

  /**
   * Subscribe to normalized webRequest events. The chrome listeners
   * are installed lazily on first subscribe; they remain installed for
   * the SW lifetime (re-disposing on every unsubscribe would thrash the
   * webRequest dispatcher).
   */
  subscribe(listener: Listener): () => void {
    if (!this.installed) this.install();
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Second channel: the extension's OWN traffic — events with
   * `tabId === -1` whose initiator is the extension origin, i.e. the
   * SW's own fetches (the request executor's sends). These never enter
   * the lifecycle pipeline (`subscribe` still sees only tab-bound
   * events); the request executor's wire capture consumes this channel
   * for facts `fetch()` withholds (Set-Cookie, remote IP).
   */
  subscribeExtensionTraffic(listener: Listener): () => void {
    if (!this.installed) this.install();
    this.extensionTrafficListeners.add(listener);
    return () => {
      this.extensionTrafficListeners.delete(listener);
    };
  }

  /** Tear down all chrome listeners. Intended for tests / SW shutdown only. */
  dispose(): void {
    for (const off of this.unsubscribes) off();
    this.unsubscribes.length = 0;
    this.listeners.clear();
    this.extensionTrafficListeners.clear();
    this.installed = false;
  }

  private install(): void {
    const browserAPI = getBrowserAPI();
    try {
      // Built from protocol + host, not `.origin` — WHATWG URL yields the
      // literal string "null" as the origin of non-special schemes like
      // chrome-extension:// in some engines.
      const base = new URL(browserAPI.runtime.getURL(''));
      this.ownOrigin = `${base.protocol}//${base.host}`;
    } catch {
      this.ownOrigin = undefined;
    }
    const wr = browserAPI.webRequest;
    if (!wr) {
      logger.info('LifecycleHost', 'webRequest API unavailable; correlator inert');
      this.installed = true;
      return;
    }

    this.bind(wr.onBeforeRequest, mapOnBeforeRequest);
    // `extraHeaders` is REQUIRED on Chromium to see the `Origin` request
    // header and `Access-Control-Allow-Origin` response header — Chrome
    // treats both as "security-sensitive" and hides them from webRequest
    // unless the listener explicitly opts in. Without this opt-in, `Origin`
    // reads as null and the H5 CORS classifier sees every request as
    // same-origin. The opt-in is paid only on the two events that need
    // it; `onBeforeRedirect` keeps just `responseHeaders` since its
    // verdict is overwritten on the next hop's `onSendHeaders`.
    //
    // Firefox does NOT recognize the `'extraHeaders'` enum value at all —
    // passing it throws a TypeError that crashes extension init. Firefox
    // surfaces those headers without an opt-in, so dropping the spec entry
    // there is both required and correct.
    const securitySensitive: string[] = isFirefox ? [] : ['extraHeaders'];
    this.bind(wr.onSendHeaders, mapOnSendHeaders, ['requestHeaders', ...securitySensitive]);
    this.bind(wr.onHeadersReceived, mapOnHeadersReceived, ['responseHeaders', ...securitySensitive]);
    this.bind(wr.onBeforeRedirect, mapOnBeforeRedirect, ['responseHeaders']);
    this.bind(wr.onCompleted, mapOnCompleted);
    this.bind(wr.onErrorOccurred, mapOnErrorOccurred);

    this.installed = true;
  }

  private bind<D>(
    event: chrome.webRequest.WebRequestEvent<(details: D) => void, string[]> | undefined,
    map: (details: D) => WebRequestEvent,
    extraInfoSpec: string[] = [],
  ): void {
    if (!event) return;
    const wrapped = (details: D): void => {
      const tabId = (details as { tabId?: number }).tabId;
      if (tabId === undefined) return;
      // Events not bound to a real tab never enter the lifecycle
      // pipeline. The extension's OWN fetches (SW-initiated, own-origin
      // initiator) route to the extension-traffic channel instead; all
      // other tab-less traffic (other extensions, browser internals) is
      // dropped as before.
      if (tabId === -1) {
        if (this.extensionTrafficListeners.size === 0) return;
        if (this.ownOrigin === undefined) return;
        if ((details as { initiator?: string }).initiator !== this.ownOrigin) return;
        this.fanExtensionTraffic(map(details));
        return;
      }
      this.fan(map(details));
    };
    // Firefox rejects an explicit `extraInfoSpec` arg on events that don't
    // accept one (e.g. `onErrorOccurred`) — even an empty array throws
    // "Incorrect argument types". Pass the third arg only when the caller
    // actually opted into something.
    if (extraInfoSpec.length > 0) {
      event.addListener(wrapped, ALL_URLS_FILTER, extraInfoSpec);
    } else {
      event.addListener(wrapped, ALL_URLS_FILTER);
    }
    this.unsubscribes.push(() => event.removeListener(wrapped));
  }

  private fan(event: WebRequestEvent): void {
    for (const listener of this.listeners) listener(event);
  }

  private fanExtensionTraffic(event: WebRequestEvent): void {
    for (const listener of this.extensionTrafficListeners) listener(event);
  }
}

// ---- chrome.webRequest details → oracle event mappers --------------------

function mapOnBeforeRequest(d: chrome.webRequest.OnBeforeRequestDetails): OnBeforeRequestEvent {
  return {
    method_kind: 'onBeforeRequest',
    tabId: d.tabId,
    requestId: d.requestId,
    url: d.url,
    method: d.method,
    type: d.type,
    timeStamp: d.timeStamp,
    initiator: readInitiator(d),
    frameId: d.frameId,
    ...(d.documentId !== undefined ? { documentId: d.documentId } : {}),
    ...(d.frameType !== undefined ? { frameType: d.frameType } : {}),
  };
}

function mapOnSendHeaders(d: chrome.webRequest.OnSendHeadersDetails): OnSendHeadersEvent {
  return {
    method_kind: 'onSendHeaders',
    tabId: d.tabId,
    requestId: d.requestId,
    url: d.url,
    method: d.method,
    type: d.type,
    timeStamp: d.timeStamp,
    initiator: readInitiator(d),
    frameId: d.frameId,
    ...(d.documentId !== undefined ? { documentId: d.documentId } : {}),
    ...(d.frameType !== undefined ? { frameType: d.frameType } : {}),
    requestHeaders: normalizeHeaders(d.requestHeaders),
  };
}

function mapOnHeadersReceived(d: chrome.webRequest.OnHeadersReceivedDetails): OnHeadersReceivedEvent {
  return {
    method_kind: 'onHeadersReceived',
    tabId: d.tabId,
    requestId: d.requestId,
    url: d.url,
    method: d.method,
    type: d.type,
    timeStamp: d.timeStamp,
    initiator: readInitiator(d),
    frameId: d.frameId,
    ...(d.documentId !== undefined ? { documentId: d.documentId } : {}),
    ...(d.frameType !== undefined ? { frameType: d.frameType } : {}),
    statusCode: d.statusCode,
    statusLine: d.statusLine,
    responseHeaders: normalizeHeaders(d.responseHeaders),
  };
}

function mapOnBeforeRedirect(d: chrome.webRequest.OnBeforeRedirectDetails): OnBeforeRedirectEvent {
  return {
    method_kind: 'onBeforeRedirect',
    tabId: d.tabId,
    requestId: d.requestId,
    url: d.url,
    method: d.method,
    type: d.type,
    timeStamp: d.timeStamp,
    initiator: readInitiator(d),
    frameId: d.frameId,
    ...(d.documentId !== undefined ? { documentId: d.documentId } : {}),
    ...(d.frameType !== undefined ? { frameType: d.frameType } : {}),
    statusCode: d.statusCode,
    redirectUrl: d.redirectUrl,
    responseHeaders: normalizeHeaders(d.responseHeaders),
    fromCache: d.fromCache,
    ...(d.ip !== undefined ? { ip: d.ip } : {}),
  };
}

function mapOnCompleted(d: chrome.webRequest.OnCompletedDetails): OnCompletedEvent {
  return {
    method_kind: 'onCompleted',
    tabId: d.tabId,
    requestId: d.requestId,
    url: d.url,
    method: d.method,
    type: d.type,
    timeStamp: d.timeStamp,
    initiator: readInitiator(d),
    frameId: d.frameId,
    ...(d.documentId !== undefined ? { documentId: d.documentId } : {}),
    ...(d.frameType !== undefined ? { frameType: d.frameType } : {}),
    statusCode: d.statusCode,
    statusLine: d.statusLine,
    fromCache: d.fromCache,
    ...(d.ip !== undefined ? { ip: d.ip } : {}),
  };
}

function mapOnErrorOccurred(d: chrome.webRequest.OnErrorOccurredDetails): OnErrorOccurredEvent {
  return {
    method_kind: 'onErrorOccurred',
    tabId: d.tabId,
    requestId: d.requestId,
    url: d.url,
    method: d.method,
    type: d.type,
    timeStamp: d.timeStamp,
    initiator: readInitiator(d),
    frameId: d.frameId,
    ...(d.documentId !== undefined ? { documentId: d.documentId } : {}),
    ...(d.frameType !== undefined ? { frameType: d.frameType } : {}),
    error: d.error,
    fromCache: d.fromCache,
    ...(d.ip !== undefined ? { ip: d.ip } : {}),
  };
}

function normalizeHeaders(
  headers: chrome.webRequest.HttpHeader[] | undefined,
): readonly WebRequestHeader[] | undefined {
  if (headers === undefined) return undefined;
  return headers.map((h) => ({ name: h.name, value: h.value }));
}

/** `initiator` exists in MV3 webRequest but is not in older `@types/chrome`. */
function readInitiator(d: { initiator?: string }): string | undefined {
  return d.initiator;
}
