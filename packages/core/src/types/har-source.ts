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
     *  populated on `chrome.devtools.network.onRequestFinished` entries
     *  whose underlying request failed before producing a real HTTP
     *  response. Absent on successful responses. */
    _error?: string;
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
  };
  serverIPAddress?: string;
  connection?: string;
  pageref?: string;
  _initiator?: unknown;
  _priority?: string;
  _resourceType?: string;
  _webSocketMessages?: unknown[];
  /** "disk" | "memory" (Chromium convention), or absent when not cached. */
  _fromCache?: string;
  /** Non-standard boolean flag some Chromium builds set alongside _fromCache. */
  _servedFromCache?: boolean;
  /** Chromium flag: the response was intercepted and served by a service
   *  worker's `fetch` handler. Populated on recent Chrome builds; absent
   *  on older ones (we fall back to other signals in the classifier). */
  _fetchedViaServiceWorker?: boolean;
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
  /** DOMContentLoaded ms (relative to navigationStart). */
  dclMs?: number;
  /** Load event ms (relative to navigationStart). */
  loadMs?: number;
}

/**
 * Wire format from the devtools_page HAR source port (`devtools-har-source:<tabId>`).
 * Two adapters cohabit on this port, each consuming a disjoint subset:
 *   - `ChromeHarEventSource` reads `har` / `har-body` → oracle correlator;
 *   - `startDevtoolsPageNavBridge` reads `nav` / `nav-timing` → page stream hub.
 *
 * `har-body` carries its payload flat (not under a nested `body` key)
 * because the devtools_page posts the fields inline — history kept to
 * avoid churning that contract.
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
  | { type: 'resource-timing'; timeOriginMs: number; entries: ResourceTimingEntry[] };
