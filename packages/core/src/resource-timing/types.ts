/**
 * Resource timing stream — shared primitive for
 * `@openheaders/core/resource-timing`.
 *
 * Third feed of the network panel data plane, alongside
 * `request-lifecycle` (per-request shape) and `page-stream`
 * (navigation shape). Where those two are fed by the background
 * `chrome.webRequest` + HAR pipeline, this one is fed by the inspected
 * page's own Resource Timing buffer
 * (`performance.getEntriesByType('resource')`).
 *
 * Why a separate feed: a renderer in-process cache hit is served
 * without ever reaching the network service, so no `webRequest` /
 * HAR event fires for it — the request is invisible to the other two
 * feeds. The Resource Timing buffer is the only banner-free surface
 * that records those hits (with `transferSize` 0 and no matching wire
 * event). The panel reconciles this feed against the real rows to
 * surface the otherwise-missing cache hits; the engine never sees it
 * (the reconciliation is panel-local).
 *
 * Model:
 *   - A `ResourceTimingEntry` is a faithful, JSON-safe projection of
 *     one `PerformanceResourceTiming`. `startTime` / `duration` and the
 *     connection legs stay relative to the document's time origin — the
 *     snapshot carries `timeOriginMs` so a consumer can lift them to
 *     wall-clock.
 *   - The connection legs (`fetchStart` … `responseEnd`) feed a second
 *     consumer: the heuristic correlator joins them onto real lifecycles
 *     so a row whose devtools HAR never arrives still gets its Timing
 *     ladder. Legs gated by `Timing-Allow-Origin` read `0` when the
 *     check fails — a consumer must treat `0` as "hidden", never as an
 *     instant step.
 *   - The buffer is cumulative and reset on navigation, so each
 *     observation is a full SNAPSHOT that supersedes the prior one
 *     (no incremental diff). `snapshot` therefore replaces, never
 *     merges.
 */

export interface ResourceTimingEntry {
  /** Resource URL (`PerformanceEntry.name`). */
  readonly name: string;
  /** `script` | `css` | `img` | `link` | `fetch` | `xmlhttprequest` | … */
  readonly initiatorType: string;
  /** Negotiated protocol id, e.g. `h2`, `http/1.1`. Empty when unknown. */
  readonly nextHopProtocol: string;
  /** ms since the document time origin. */
  readonly startTime: number;
  /** Wall duration in ms. */
  readonly duration: number;
  /**
   * Connection legs, ms since the document time origin. All of these
   * except `fetchStart` are gated by the Timing-Allow-Origin check and
   * read `0` for a cross-origin resource that does not pass it. On a
   * reused connection the dns/connect legs collapse onto `fetchStart`
   * (zero-width at the same instant). `responseEnd` is `0` while (or if)
   * the body never finished downloading.
   */
  readonly workerStart: number;
  readonly redirectStart: number;
  readonly redirectEnd: number;
  readonly fetchStart: number;
  readonly domainLookupStart: number;
  readonly domainLookupEnd: number;
  readonly connectStart: number;
  readonly connectEnd: number;
  readonly secureConnectionStart: number;
  readonly requestStart: number;
  /**
   * First byte of the FIRST response — when the server sent a 103 interim
   * response, this is the interim's first byte, far ahead of the real
   * headers. `finalResponseHeadersStart` is the final-response instant the
   * wait leg must end at; `0` where the engine doesn't expose it (then
   * `responseStart` is the final response).
   */
  readonly responseStart: number;
  readonly firstInterimResponseStart: number;
  readonly finalResponseHeadersStart: number;
  readonly responseEnd: number;
  /** Bytes over the wire — `0` for a cache hit. */
  readonly transferSize: number;
  /** Encoded (compressed) body size in bytes. */
  readonly encodedBodySize: number;
  /** Decoded resource size in bytes. */
  readonly decodedBodySize: number;
  /** `cache` for cache hits; `''` otherwise (or `navigational-prefetch`). */
  readonly deliveryType: string;
  /** HTTP status when exposed (same-origin / Timing-Allow-Origin); `0` otherwise. */
  readonly responseStatus?: number;
}

/**
 * Wire-shaped update emitted by the resource-timing hub and applied by
 * the panel reducer. `snapshot` replaces the tab's known entry list
 * wholesale (the buffer is cumulative); `tab-cleared` drops it. Both
 * carry `tabId` to stay parallel with `PageStreamUpdate`.
 */
export type ResourceTimingUpdate =
  | {
      kind: 'snapshot';
      tabId: number;
      /** Wall-clock ms of the document time origin for this snapshot. */
      timeOriginMs: number;
      entries: readonly ResourceTimingEntry[];
    }
  | { kind: 'tab-cleared'; tabId: number };
