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
  private readonly unsubscribes: Array<() => void> = [];
  private installed = false;

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

  /** Tear down all chrome listeners. Intended for tests / SW shutdown only. */
  dispose(): void {
    for (const off of this.unsubscribes) off();
    this.unsubscribes.length = 0;
    this.listeners.clear();
    this.installed = false;
  }

  private install(): void {
    const browserAPI = getBrowserAPI();
    const wr = browserAPI.webRequest;
    if (!wr) {
      logger.info('LifecycleHost', 'webRequest API unavailable; correlator inert');
      this.installed = true;
      return;
    }

    this.bind(wr.onBeforeRequest, (details) => this.fan(mapOnBeforeRequest(details)));
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
    this.bind(wr.onSendHeaders, (details) => this.fan(mapOnSendHeaders(details)), [
      'requestHeaders',
      ...securitySensitive,
    ]);
    this.bind(wr.onHeadersReceived, (details) => this.fan(mapOnHeadersReceived(details)), [
      'responseHeaders',
      ...securitySensitive,
    ]);
    this.bind(wr.onBeforeRedirect, (details) => this.fan(mapOnBeforeRedirect(details)), ['responseHeaders']);
    this.bind(wr.onCompleted, (details) => this.fan(mapOnCompleted(details)));
    this.bind(wr.onErrorOccurred, (details) => this.fan(mapOnErrorOccurred(details)));

    this.installed = true;
  }

  private bind<D>(
    event: chrome.webRequest.WebRequestEvent<(details: D) => void, string[]> | undefined,
    handler: (details: D) => void,
    extraInfoSpec: string[] = [],
  ): void {
    if (!event) return;
    const wrapped = (details: D): void => {
      // Skip events not bound to a real tab. Background-fetch /
      // service-worker traffic surfaces with tabId === -1 and is never
      // routed through the lifecycle pipeline.
      if ((details as { tabId?: number }).tabId === undefined) return;
      if ((details as { tabId: number }).tabId === -1) return;
      handler(details);
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
