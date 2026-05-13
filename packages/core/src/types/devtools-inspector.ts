/**
 * DevTools inspector wire types.
 *
 * The extension's devtools port relays HAR + fire + nav messages between
 * the devtools page, the background, and the panel React store. The
 * background re-emits a subset of the source format to inspector
 * panels; both contracts live here so the panel's data layer can parse
 * against them without depending on engine internals.
 */

import type { RequestRecord } from './telemetry';

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
 * Wire format for messages posted over the inspector port. Discriminated
 * union keyed by `type`. The panel's data layer parses incoming messages
 * against this shape.
 *
 * `chromeRequestId` on the `har` variant is the deterministic join key
 * the background attaches by correlating the HAR with the per-URL FIFO
 * of in-flight webRequest observations. Optional because very early
 * requests on a cold tab may land before the in-flight queue has a
 * matching entry — the panel falls back to URL + window matching for
 * those rows.
 */
export type InspectorPortMessage =
  | { type: 'fire'; record: RequestRecord; authoritative: boolean }
  | { type: 'har'; entry: InspectorHarEntry; chromeRequestId?: string }
  | { type: 'har-body'; body: InspectorHarBody }
  | { type: 'nav'; url: string }
  | { type: 'nav-timing'; timing: InspectorNavTiming }
  | { type: 'ready'; tabId: number };

/**
 * Wire format from the devtools_page HAR source port. The background
 * re-emits a subset of these (translated to `InspectorPortMessage`) to
 * inspector panels. `har-body` carries its payload flat (not under a
 * nested `body` key) because the devtools_page posts the fields inline
 * — history we keep to avoid churning that contract.
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
  | { type: 'nav-timing'; timing: InspectorNavTiming };
