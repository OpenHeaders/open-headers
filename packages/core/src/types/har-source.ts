/**
 * DevTools HAR-source wire types.
 *
 * The devtools_page injected into a tab forwards HAR entries, HAR
 * bodies, and navigation signals to the background over the
 * `devtools-har-source:<tabId>` port. The shapes live in core because
 * both the chrome adapter (`ChromeHarEventSource`, nav bridge) and the
 * panel data layer (HAR projections, snippet generators, waterfall)
 * parse against them.
 *
 * Rule fires travel via `@openheaders/oracle/rule-fire-hub`
 * (`oh-fires:<tabId>`). Request lifecycle (started/completed/redirect/
 * error) travels via `@openheaders/oracle/request-lifecycle-hub`
 * (`oh-lifecycle:<tabId>`) as structured `RequestLifecycle`, not as
 * standalone wire messages — observable error refinement (`oh:cors-*`
 * codes on `error.code`) is produced by the oracle correlator and
 * carried on the lifecycle. The underlying CORS classification stays
 * engine-internal (see `correlator-heuristic/cors-types.ts`).
 */

import type { ResourceTimingEntry } from '../resource-timing/types';

/**
 * Raw protocol timing instants for one hop — present only when the CDP
 * plane recorded them (the heuristic path has no raw instants and never
 * sets this). The exporter's `timings` legs are re-anchored, folded
 * spans (the connection-stage gaps are folded into the following leg);
 * these are the unfolded originals, so a consumer can decompose the
 * request exactly the way the browser's own Timing tab does — each leg
 * between its true instants, the inter-leg gaps rendered nowhere, and
 * the total as the range span rather than a leg sum.
 *
 * Units: `*Sec` fields are monotonic instants in seconds (one shared
 * clock); every other field is a millisecond offset from
 * `requestTimeSec`, with `-1`/absent meaning the leg did not occur.
 *
 * Internal to the panel — stripped from HAR exports (a saved HAR stays
 * byte-shaped like the browser's own).
 */
export interface InspectorRawTiming {
  /** Monotonic issue instant — the queueing start. */
  issuedSec: number;
  /** Monotonic network-start baseline for the ms offsets below. */
  requestTimeSec: number;
  proxyStart?: number;
  proxyEnd?: number;
  dnsStart?: number;
  dnsEnd?: number;
  connectStart?: number;
  connectEnd?: number;
  sslStart?: number;
  sslEnd?: number;
  sendStart?: number;
  sendEnd?: number;
  receiveHeadersStart?: number;
  receiveHeadersEnd?: number;
  workerStart?: number;
  workerReady?: number;
  workerFetchStart?: number;
  workerRespondWithSettled?: number;
  /**
   * Monotonic instant of the headers-received event. The effective
   * first-byte instant is this clamped to at most `requestTimeSec +
   * receiveHeadersEnd/1000` — the same clamp the browser applies when it
   * takes its response-received time from the timing block. Absent on a
   * redirect hop (no discrete headers event; the offset alone decides).
   */
  responseReceivedSec?: number;
  /** Monotonic terminal instant (finished or failed) — the receive end.
   *  Absent while the hop is still streaming. */
  endSec?: number;
}

/**
 * Full HAR entry forwarded verbatim from the devtools_page via
 * `chrome.devtools.network.onRequestFinished`. The shape matches the
 * HAR 1.2 spec that Chrome implements, plus the non-standard `_`-
 * prefixed extensions (`_initiator`, `_priority`, `_resourceType`,
 * `_webSocketMessages`, `_fromCache`) that DevTools annotates onto
 * each entry. The background doesn't interpret any of this — it just
 * relays entries to the panel's data layer.
 *
 * All fields are optional because the HAR format is structurally open
 * and future Chrome versions may add or remove `_`-prefixed metadata.
 * The panel's UI reads defensively through optional chaining.
 */
export interface InspectorHarEntry {
  startedDateTime: string;
  time?: number;
  request?: {
    method: string;
    url: string;
    httpVersion?: string;
    headers: Array<{ name: string; value: string }>;
    queryString: Array<{ name: string; value: string }>;
    cookies?: Array<{ name: string; value: string }>;
    headersSize?: number;
    bodySize?: number;
    postData?: {
      mimeType: string;
      text?: string;
      params?: Array<{ name: string; value?: string }>;
    };
  };
  response?: {
    status: number;
    statusText: string;
    httpVersion?: string;
    headers: Array<{ name: string; value: string }>;
    cookies?: Array<{ name: string; value: string }>;
    content: {
      size: number;
      mimeType: string;
      compression?: number;
      text?: string;
      encoding?: string;
    };
    redirectURL?: string;
    headersSize?: number;
    bodySize?: number;
    /** Chromium extension: total bytes received over the wire — encoded
     *  response headers plus the encoded (compressed) body. Standard
     *  `bodySize` is `-1` for any compressed or cache-served response,
     *  so `_transferSize` is the only reliable wire-byte count. `0` for
     *  cache hits; absent on older Chromium builds. */
    _transferSize?: number;
    /** Chromium extension: net-stack error code (e.g. "net::ERR_CERT_DATE_INVALID")
     *  on a request that failed before a real HTTP response. Chrome's
     *  exporter emits this on every entry — `null` on a clean response. */
    _error?: string | null;
    /** Chromium extension: the response was produced by a service worker's
     *  `fetch` handler. Chrome's exporter emits this in the response section
     *  on every entry (`false` when not SW-served). */
    _fetchedViaServiceWorker?: boolean;
    /** Synthesized entries only: the body download never completed — the
     *  document's own timing recorded no response end while the request hit
     *  a terminal error (canceled mid-stream). Drives the not-finished
     *  caution the host shows for a request its protocol plane never
     *  finishes. */
    _responseBodyIncomplete?: boolean;
  };
  cache?: unknown;
  timings?: {
    blocked?: number;
    dns?: number;
    connect?: number;
    send?: number;
    wait?: number;
    receive?: number;
    ssl?: number;
    /** Chrome-exporter extension: portion of `blocked` spent in the
     *  resource-scheduler queue (vs raw connection-level stalling).
     *  Subtracting from `blocked` yields the Stalled duration. */
    _blocked_queueing?: number;
    /** Chrome-exporter extension: proxy negotiation duration, present only
     *  when the request went through a proxy. */
    _blocked_proxy?: number;
    /** Chrome-exporter extensions: service-worker timing legs, the raw CDP
     *  offsets (`-1` when the response was not service-worker-handled).
     *  Chrome emits all four on every entry that carries timing. */
    _workerStart?: number;
    _workerReady?: number;
    _workerFetchStart?: number;
    _workerRespondWithSettled?: number;
  };
  serverIPAddress?: string;
  connection?: string;
  /** Chromium extension: physical connection id reused across requests on
   *  the same socket. Omitted for cache hits / connection id `0`. */
  _connectionId?: string;
  pageref?: string;
  _initiator?: unknown;
  /** Scheduler priority Chrome's exporter emits on every entry — `null`
   *  when the host reported none. */
  _priority?: string | null;
  _resourceType?: string;
  _webSocketMessages?: unknown[];
  /** "disk" | "memory" (Chromium convention), or absent when not cached. */
  _fromCache?: string;
  /** Non-standard boolean flag some Chromium builds set alongside _fromCache. */
  _servedFromCache?: boolean;
  /** Raw protocol timing instants (CDP-recorded hops only) — the unfolded
   *  originals behind the exporter-dialect `timings` legs. Internal: the
   *  timing ladder prefers these when present; HAR exports strip them. */
  _rawTiming?: InspectorRawTiming;
}

/**
 * HAR 1.2 `log.pages[i].pageTimings` — navigation milestones as offsets
 * (ms) from the page's `startedDateTime`. `-1` encodes "not observed".
 */
export interface InspectorHarPageTimings {
  onContentLoad: number;
  onLoad: number;
}

/**
 * HAR 1.2 `log.pages[i]` — one navigation. Carried verbatim from the host's
 * `chrome.devtools.network` HAR so the export can adopt the host's own page
 * block (its `pageTimings` floats and `startedDateTime`) byte-for-byte; CDP
 * synthesis reconstructs this block only for pages the host HAR never saw.
 */
export interface InspectorHarPage {
  startedDateTime: string;
  id: string;
  title: string;
  pageTimings: InspectorHarPageTimings;
}

/**
 * The host's own HAR for the inspected tab — entries plus the page block,
 * fetched in one `chrome.devtools.network.getHAR` round-trip. The HAR export
 * reconciles its CDP-synthesized output against both: each row swaps to its
 * host entry verbatim, and each referenced page adopts the host's page block.
 */
export interface InspectorHarLog {
  entries: readonly InspectorHarEntry[];
  pages: readonly InspectorHarPage[];
}

/** Response body payload fetched asynchronously via entry.getContent. */
export interface InspectorHarBody {
  method: string;
  url: string;
  startedDateTime: string;
  content: string;
  encoding: string;
}

/**
 * Page-level navigation timing snapshot, sourced via
 * `chrome.devtools.inspectedWindow.eval` of
 * `performance.getEntriesByType('navigation')`. All values are ms since
 * navigationStart; omitted fields mean the event hasn't fired yet or
 * isn't applicable (e.g. frame-only navigations).
 */
export interface InspectorNavTiming {
  /** Origin the metrics were sampled from — used as the "same page" baseline. */
  pageOrigin: string | null;
  /**
   * Navigation-start wall clock (`performance.timeOrigin`), ms since epoch.
   * The accurate page-start the hub uses to correct the `page-started`
   * placeholder, which is stamped at nav-commit (later than nav-start).
   */
  navStartMs?: number;
  /** DOMContentLoaded ms (relative to navigationStart). */
  dclMs?: number;
  /** Load event ms (relative to navigationStart). */
  loadMs?: number;
}

/**
 * Wire format from the devtools_page HAR source port (`devtools-har-source:<tabId>`).
 * Several adapters cohabit on this port, each consuming a disjoint subset:
 *   - `ChromeHarEventSource` reads `har` / `har-body` → oracle correlator;
 *   - `startDevtoolsPageNavBridge` reads `nav` / `nav-timing` → page stream hub;
 *   - `ResourceTimingRelay` reads `resource-timing` → memory-cache rows;
 *   - `DevtoolsSessionCoordinator` reads `session` → per-DevTools-session reset.
 *
 * `har-body` carries its payload flat (not under a nested `body` key)
 * because the devtools_page posts the fields inline — history kept to
 * avoid churning that contract.
 *
 * `session` is the per-DevTools-session spine: the devtools_page mints one
 * token per DevTools-open and posts it as the first frame on every
 * (re)connect of this port. A genuine reopen mints a new token; an
 * SW-eviction reconnect replays the same one. `openedAtWallMs` is the
 * wall-clock (`Date.now()`) DevTools opened — the floor everything
 * session-scoped resets to, so the reopened log starts at the open moment
 * regardless of what `webRequest` captured while DevTools was closed.
 */
export type HarSourceMessage =
  | { type: 'har'; entry: InspectorHarEntry }
  | {
      type: 'har-body';
      method: string;
      url: string;
      startedDateTime: string;
      content?: string;
      encoding?: string;
    }
  | { type: 'nav'; url: string }
  | { type: 'nav-timing'; timing: InspectorNavTiming }
  | {
      type: 'resource-timing';
      timeOriginMs: number;
      entries: ResourceTimingEntry[];
      /**
       * The document's own `PerformanceNavigationTiming`, projected to the
       * same shape — the only timing source for the document row. Carried
       * apart from `entries` (which hold `resource` entries only) so the
       * panel's memory-cache reconciliation never counts it as a resource.
       */
      navigation?: ResourceTimingEntry;
    }
  | { type: 'session'; token: string; openedAtWallMs: number };

/** Channel-name prefix for the devtools_page HAR source port. */
export const HAR_SOURCE_PORT_PREFIX = 'devtools-har-source:';

/** Build `devtools-har-source:<tabId>`. */
export function harSourcePortName(tabId: number): string {
  return `${HAR_SOURCE_PORT_PREFIX}${tabId}`;
}

/** Parse `devtools-har-source:<tabId>`. Returns `null` for any other shape. */
export function parseHarSourcePortName(name: string): number | null {
  if (!name.startsWith(HAR_SOURCE_PORT_PREFIX)) return null;
  const parsed = Number.parseInt(name.slice(HAR_SOURCE_PORT_PREFIX.length), 10);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}
