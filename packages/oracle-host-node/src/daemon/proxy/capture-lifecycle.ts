/**
 * Capture → request-lifecycle mapper (`PROXY_PLAN.md` §1.2 hard law —
 * the proxy produces lifecycles, it owns no viewer). Turns the MITM
 * server's {@link ProxyCaptureObserver} callbacks into
 * `RequestLifecycleUpdate`s on the reserved proxy partition
 * ({@link PROXY_LIFECYCLE_TAB_ID}), so proxy captures render in the same
 * panel as browser tabs with zero new inspection UI.
 *
 * Read-only phase: only the fields an existing correlator already
 * populates are used (method / url / headers / status / phase timings) —
 * no new lifecycle field is introduced, so the store reducer and the
 * panel client reducer need no twin change. Body/HAR attachment and L4
 * socket timings are later slices.
 */

import { PROXY_LIFECYCLE_TAB_ID } from '@openheaders/core/proxy';
import type { RequestLifecycle, RequestLifecycleUpdate } from '@openheaders/core/request-lifecycle';
import type {
  ProxyCaptureObserver,
  ProxyExchangeEnd,
  ProxyExchangeError,
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

export class ProxyCaptureLifecycleMapper implements ProxyCaptureObserver {
  constructor(private readonly emit: LifecycleSink) {}

  onRequestStart(start: ProxyRequestStart): void {
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

  onResponseHeaders(id: string, head: ProxyResponseHead): void {
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
  }

  onError(id: string, error: ProxyExchangeError): void {
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
