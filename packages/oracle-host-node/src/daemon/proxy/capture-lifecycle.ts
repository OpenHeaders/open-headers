/**
 * Capture → request-lifecycle mapper (the proxy plan §1.2 hard law —
 * the proxy produces lifecycles, it owns no viewer). Turns the MITM
 * server's {@link ProxyCaptureObserver} callbacks into
 * `RequestLifecycleUpdate`s on the reserved proxy partition
 * ({@link PROXY_LIFECYCLE_TAB_ID}), so proxy captures render in the same
 * panel as browser tabs with zero new inspection UI.
 *
 * Phase 3 additions ride EXISTING update shapes only — no new lifecycle
 * field, so the store reducer and the panel client reducer need no twin
 * change:
 *
 *  - a rule's in-place URL rewrite emits the `redirect` update with the
 *    internal hop (status 307, `internal: true`) — the exact synthetic
 *    hop the heuristic correlator mints for a DNR rewrite;
 *  - completion attaches a synthesized HAR entry (`har-attached`) on the
 *    final hop, carrying the wire headers, measured byte counts and the
 *    proxy's own L4 timing legs — the waterfall and detail tabs light up
 *    through the panel's existing HAR path;
 *  - a body rule's two-sided capture rides `request-override-attached` /
 *    `response-override-attached`, and the teed response body is retained
 *    OUT of the row (the injected {@link ProxyBodyRetainer}) for the
 *    lifeline's lazy `request-body` pull.
 */

import { PROXY_LIFECYCLE_TAB_ID } from '@openheaders/core/proxy';
import type {
  RequestLifecycle,
  RequestLifecycleUpdate,
  RequestOverride,
  ResponseOverride,
} from '@openheaders/core/request-lifecycle';
import type { ProxyBodyRetainer } from './body-store';
import { proxyHarEntry } from './capture-har';
import type {
  ProxyCaptureObserver,
  ProxyExchangeEnd,
  ProxyExchangeError,
  ProxyInternalRedirect,
  ProxyRequestStart,
  ProxyResponseHead,
} from './mitm-types';

/** Sink the mapper emits into — the daemon wires this to the store's `apply`. */
export type LifecycleSink = (update: RequestLifecycleUpdate) => void;

/**
 * Proxy captures carry no browser resource-type classification; every
 * row reads `other` until a later slice infers a finer type from the
 * request (mirrors the browser's fallback bucket).
 */
const PROXY_RESOURCE_TYPE = 'other';

/** The internal-rewrite hop's status — the heuristic correlator's synthetic 307. */
const INTERNAL_REDIRECT_STATUS = 307;

/** In-flight facts held per exchange until the terminal callback. */
interface PendingExchange {
  start: ProxyRequestStart;
  /** Current (post-rewrite) URL — the hop the HAR entry describes. */
  url: string;
  hopIndex: number;
  head?: ProxyResponseHead;
}

export class ProxyCaptureLifecycleMapper implements ProxyCaptureObserver {
  private readonly pending = new Map<string, PendingExchange>();

  constructor(
    private readonly emit: LifecycleSink,
    private readonly bodies?: ProxyBodyRetainer,
  ) {}

  onRequestStart(start: ProxyRequestStart): void {
    this.pending.set(start.id, { start, url: start.url, hopIndex: 0 });
    const lifecycle: RequestLifecycle = {
      tabId: PROXY_LIFECYCLE_TAB_ID,
      requestId: start.id,
      url: start.url,
      method: start.method,
      resourceType: PROXY_RESOURCE_TYPE,
      phase: 'pending',
      redirectHopCount: 0,
      redirectHops: [],
      startedAtMs: start.startedAtMs,
      hopStartedAtMs: start.startedAtMs,
      // On-the-wire headers we actually forwarded — authoritative, not the
      // cooked/provisional set.
      requestHeaders: start.headers.map((h) => ({ name: h.name, value: h.value })),
      requestHeadersProvisional: false,
      har: [],
      harBodyByHop: [],
    };
    this.emit({ kind: 'started', lifecycle });
  }

  onInternalRedirect(id: string, redirect: ProxyInternalRedirect): void {
    const entry = this.pending.get(id);
    if (entry !== undefined) {
      entry.url = redirect.redirectUrl;
      entry.hopIndex += 1;
    }
    this.emit({
      kind: 'redirect',
      tabId: PROXY_LIFECYCLE_TAB_ID,
      requestId: id,
      hop: {
        sourceUrl: redirect.sourceUrl,
        redirectUrl: redirect.redirectUrl,
        statusCode: INTERNAL_REDIRECT_STATUS,
        timestampMs: redirect.atMs,
        internal: true,
      },
      nextUrl: redirect.redirectUrl,
    });
  }

  onRequestOverride(id: string, override: RequestOverride): void {
    this.emit({ kind: 'request-override-attached', tabId: PROXY_LIFECYCLE_TAB_ID, requestId: id, override });
  }

  onResponseOverride(id: string, override: ResponseOverride): void {
    this.emit({ kind: 'response-override-attached', tabId: PROXY_LIFECYCLE_TAB_ID, requestId: id, override });
  }

  onResponseHeaders(id: string, head: ProxyResponseHead): void {
    const entry = this.pending.get(id);
    if (entry !== undefined) entry.head = head;
    this.emit({
      kind: 'phase',
      tabId: PROXY_LIFECYCLE_TAB_ID,
      requestId: id,
      patch: {
        phase: 'headers-received',
        statusCode: head.statusCode,
        statusText: head.statusText,
        responseHeaders: head.headers.map((h) => ({ name: h.name, value: h.value })),
      },
    });
  }

  onComplete(id: string, end: ProxyExchangeEnd): void {
    this.emit({
      kind: 'phase',
      tabId: PROXY_LIFECYCLE_TAB_ID,
      requestId: id,
      patch: { phase: 'completed', completedAtMs: end.completedAtMs },
    });
    const entry = this.pending.get(id);
    this.pending.delete(id);
    if (entry?.head === undefined) return;
    this.emit({
      kind: 'har-attached',
      tabId: PROXY_LIFECYCLE_TAB_ID,
      requestId: id,
      hopIndex: entry.hopIndex,
      har: proxyHarEntry(entry.start, entry.url, entry.head, end),
    });
    if (this.bodies !== undefined && end.responseBody !== undefined && end.responseBody.totalBytes > 0) {
      this.bodies.retain(id, entry.hopIndex, {
        method: entry.start.method,
        url: entry.url,
        startedAtMs: entry.start.startedAtMs,
        body: end.responseBody,
        ...(end.responseContentEncoding !== undefined ? { contentEncoding: end.responseContentEncoding } : {}),
      });
    }
  }

  onError(id: string, error: ProxyExchangeError): void {
    this.pending.delete(id);
    this.emit({
      kind: 'phase',
      tabId: PROXY_LIFECYCLE_TAB_ID,
      requestId: id,
      patch: {
        phase: 'failed',
        completedAtMs: error.atMs,
        error: { code: error.code, reason: error.reason },
      },
    });
  }
}
